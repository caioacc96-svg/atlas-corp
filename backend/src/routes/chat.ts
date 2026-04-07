import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { router } from '../lib/llm/router';
import { augmentWithRAG, chunkText, ingestDocument } from '../lib/llm/retriever';
import { createThread, getThread, listThreads, saveThread } from '../lib/llm/threads';
import { migrateFromLegacyStore } from '../lib/llm/threads';
import { AllProvidersFailedError, ProviderError } from '../lib/llm/errors';
import type { ChatRole } from '../lib/llm/types';
import { getAtlasConfig } from '../config/atlas-config';

// --- Schemas ---

const ChatStreamSchema = z.object({
  conversationId: z.string().uuid().optional(),
  content: z.string().trim().min(1),
});

const ChatMessageBody = z.object({
  message: z.string().min(1, 'message is required'),
  threadId: z.string().uuid().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  useRag: z.boolean().default(true),
  stream: z.boolean().default(false),
});

function writeLine(reply: { raw: NodeJS.WritableStream }, payload: unknown) {
  reply.raw.write(`${JSON.stringify(payload)}\n`);
}

// --- Legacy route: NDJSON streaming (backwards compat) ---

export async function registerChatRoutes(app: FastifyInstance) {
  // Conversation list (reads from threads)
  app.get('/chat/conversations', async () => {
    await migrateFromLegacyStore();
    const threads = await listThreads();
    return threads.map((t) => ({
      id: t.id,
      title: t.title,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      messageCount: 0, // Would need to load each thread
      model: '',
    }));
  });

  // Create conversation → creates thread
  app.post('/chat/conversations', async (request, reply) => {
    const parsed = z.object({ model: z.string().trim().optional() }).safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_conversation_create', issues: parsed.error.issues };
    }
    const thread = await createThread('Nova conversa');
    return {
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      messageCount: 0,
      model: parsed.data.model || '',
    };
  });

  // Get messages for conversation
  app.get('/chat/conversations/:conversationId/messages', async (request) => {
    const { conversationId } = request.params as { conversationId: string };
    const thread = await getThread(conversationId);
    if (!thread) return [];
    return thread.messages.map((m) => ({
      id: randomUUID(),
      conversationId: thread.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      model: m.model,
      status: m.status,
    }));
  });

  // Rename conversation
  app.patch('/chat/conversations/:conversationId', async (request, reply) => {
    const parsed = z.object({ title: z.string().trim().min(1).max(120) }).safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_rename', issues: parsed.error.issues };
    }
    const { conversationId } = request.params as { conversationId: string };
    const thread = await getThread(conversationId);
    if (!thread) {
      reply.code(404);
      return { error: 'thread_not_found' };
    }
    thread.title = parsed.data.title;
    await saveThread(thread);
    return {
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      messageCount: thread.messages.length,
      model: '',
    };
  });

  // Stream chat (legacy NDJSON endpoint — backwards compatible)
  app.post('/chat/stream', async (request, reply) => {
    const parsed = ChatStreamSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_chat_payload', issues: parsed.error.issues };
    }

    const cfg = getAtlasConfig();
    let thread = parsed.data.conversationId ? await getThread(parsed.data.conversationId) : null;
    if (!thread) {
      thread = await createThread(parsed.data.content.slice(0, 60));
    }

    const userMsg = { role: 'user' as ChatRole, content: parsed.data.content, createdAt: new Date().toISOString(), status: 'complete' as const };

    // Write NDJSON meta
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const conversation = {
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: new Date().toISOString(),
      messageCount: thread.messages.length,
      model: '',
    };

    const userMessage = {
      id: `message-${randomUUID()}`,
      conversationId: thread.id,
      role: 'user' as const,
      content: parsed.data.content,
      createdAt: new Date().toISOString(),
      status: 'complete',
    };

    writeLine(reply, { type: 'conversation', conversation });
    writeLine(reply, { type: 'user-message', message: userMessage });

    const assistantMsgId = `message-${randomUUID()}`;
    const assistantMessage = {
      id: assistantMsgId,
      conversationId: thread.id,
      role: 'assistant' as const,
      content: '',
      createdAt: new Date().toISOString(),
      model: cfg.remoteModel,
      status: 'streaming' satisfies ChatMessage['status'],
    };

    writeLine(reply, { type: 'assistant-start', message: assistantMessage });

    // Augment messages with RAG
    const historyChatMessages = thread.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const ragQuery = parsed.data.content;

    let ragStatus = 'skipped';
    let ragChunkCount = 0;
    let augmentedMessages = historyChatMessages;

    if (cfg.ragEnabled) {
      try {
        const ragResult = await augmentWithRAG(historyChatMessages, ragQuery);
        ragStatus = ragResult.ragStatus;
        ragChunkCount = ragResult.chunkCount;
        augmentedMessages = ragResult.messages;
        if (ragResult.ragUsed) {
          writeLine(reply, { type: 'rag', found: ragResult.chunkCount });
        }
      } catch {
        // RAG non-critical
      }
    }

    // Add user message to history
    augmentedMessages.push({ role: 'user' as const, content: parsed.data.content });

    // Stream via router
    const taskType = augmentedMessages.length > 4 ? 'chat_simple' : 'chat_simple';
    let fullText = '';

    try {
      const chatResponse = await router.stream(
        { messages: augmentedMessages, taskType },
        undefined,
        async (chunk) => {
          if (chunk.content) {
            fullText += chunk.content;
            writeLine(reply, {
              type: 'delta',
              messageId: assistantMessage.id,
              conversationId: thread!.id,
              delta: chunk.content,
            });
          }
        },
      );

      assistantMessage.content = fullText;
      assistantMessage.status = 'complete';
      assistantMessage.model = chatResponse.model || cfg.remoteModel;

      // Persist
      thread!.messages.push(userMsg);
      thread!.messages.push({ role: 'assistant', content: fullText, createdAt: new Date().toISOString(), model: assistantMessage.model, status: 'complete' as const });
      await saveThread(thread!);

      writeLine(reply, { type: 'done', conversation, message: assistantMessage });
    } catch (error) {
      thread!.messages.push(userMsg);
      thread!.messages.push({ role: 'assistant', content: '', createdAt: new Date().toISOString(), status: 'error' });
      await saveThread(thread!);

      writeLine(reply, {
        type: 'error',
        message: error instanceof Error ? error.message : 'Falha ao gerar resposta.',
        code: 'atlas_chat_generation_failed',
      });
    } finally {
      raw.end();
    }
  });

  // --- New endpoint: POST /chat/message (modern interface) ---

  app.post('/chat/message', async (req, reply) => {
    const parse = ChatMessageBody.safeParse(req.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'invalid_request', details: parse.error.flatten() });
    }

    const { message, threadId, provider, model, temperature, useRag, stream } = parse.data;

    let thread = threadId ? await getThread(threadId) : null;
    if (!thread) {
      thread = await createThread(message.slice(0, 60));
    }

    const userMessage = { role: 'user' as const, content: message, createdAt: new Date().toISOString(), status: 'complete' as const };
    const historyMessages = thread.messages.map((m) => ({ role: m.role, content: m.content }));

    let augmented = [...historyMessages];
    let ragUsed = false;
    let ragChunks = 0;
    let ragStatus: 'used' | 'skipped' | 'failed' | 'empty' | 'unavailable' = 'skipped';
    let ragError: string | undefined;

    if (useRag) {
      const ragResult = await augmentWithRAG(historyMessages, message);
      augmented = ragResult.messages;
      ragUsed = ragResult.ragUsed;
      ragChunks = ragResult.chunkCount;
      ragStatus = ragResult.ragStatus;
      ragError = ragResult.ragError;
    }

    augmented.push({ role: 'user', content: message });

    const baseRequest = {
      messages: augmented,
      model,
      temperature,
      stream,
    };

    const sendFailure = (err: unknown) => {
      if (err instanceof AllProvidersFailedError) {
        return reply.status(503).send({
          error: 'all_providers_failed',
          message: err.message,
          details: err.details,
          meta: { ragUsed, ragChunks, ragStatus, ragError },
        });
      }
      if (err instanceof ProviderError) {
        return reply.status(502).send({
          error: 'provider_error',
          provider: err.provider,
          message: err.message,
          meta: { ragUsed, ragChunks, ragStatus, ragError },
        });
      }
      return reply.status(500).send({ error: 'internal_error', message: String(err) });
    };

    if (stream) {
      try {
        thread!.messages.push(userMessage);
        await saveThread(thread!);

        reply.raw.writeHead(200, {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        let finalContent = '';
        const chatResponse = await router.stream(baseRequest, provider, async (chunk) => {
          if (chunk.content) {
            finalContent += chunk.content;
            reply.raw.write(`${JSON.stringify({ type: 'chunk', delta: chunk.content })}\n`);
          }
        });

        await saveThread(thread!); // messages already added above
        thread!.messages.push({ role: 'assistant', content: finalContent || chatResponse.content, createdAt: new Date().toISOString(), model: chatResponse.model, status: 'complete' });
        await saveThread(thread!);

        reply.raw.write(`${JSON.stringify({
          type: 'final',
          threadId: thread!.id,
          message: finalContent || chatResponse.content,
          meta: {
            provider: chatResponse.provider,
            model: chatResponse.model,
            latencyMs: chatResponse.latencyMs,
            ragUsed,
            ragChunks,
            ragStatus,
            ragError,
          },
        })}\n`);
        reply.raw.end();
        return reply;
      } catch (err: unknown) {
        return sendFailure(err);
      }
    }

    try {
      const chatResponse = await router.chat(baseRequest, provider);
      thread!.messages.push(userMessage);
      thread!.messages.push({ role: 'assistant', content: chatResponse.content, createdAt: new Date().toISOString(), model: chatResponse.model, status: 'complete' });
      await saveThread(thread!);

      return reply.send({
        threadId: thread!.id,
        message: chatResponse.content,
        meta: {
          provider: chatResponse.provider,
          model: chatResponse.model,
          latencyMs: chatResponse.latencyMs,
          ragUsed,
          ragChunks,
          ragStatus,
          ragError,
          promptTokens: chatResponse.promptTokens,
          completionTokens: chatResponse.completionTokens,
        },
      });
    } catch (err: unknown) {
      return sendFailure(err);
    }
  });
}

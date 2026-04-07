import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ingestDocument, retrieveContext } from '../lib/llm/retriever';
import { vectorStore } from '../lib/llm/vectorstore';
import { ProviderError } from '../lib/llm/errors';

const IngestBody = z.object({
  text: z.string().trim().min(1),
  content: z.string().trim().min(1),
  source: z.string().trim().optional(),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).refine((d) => d.text || d.content, { message: 'text or content is required' });

const SearchBody = z.object({
  query: z.string().trim().min(1, 'query is required'),
  topK: z.coerce.number().int().min(1).max(20).optional(),
});

export async function registerRagRoutes(app: FastifyInstance) {
  app.post('/rag/ingest', async (request, reply) => {
    const parsed = IngestBody.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_ingest', issues: parsed.error.issues };
    }

    const { text, content, source, title, tags } = parsed.data;
    const bodyText = (text || content) as string;
    const metadata: Record<string, unknown> = {};
    if (source) metadata.source = source;
    if (title) metadata.title = title;
    if (tags) metadata.tags = tags;

    try {
      const result = await ingestDocument(bodyText, metadata);
      return reply.status(201).send({ ok: true, chunkCount: result.chunkCount, model: result.model, stats: vectorStore.stats() });
    } catch (err: unknown) {
      if (err instanceof ProviderError) {
        return reply.status(503).send({
          error: 'embed_provider_unavailable',
          message: err.message,
          hint: 'Start Ollama: ollama serve | Pull model: ollama pull nomic-embed-text',
        });
      }
      return reply.status(500).send({ error: 'ingest_failed', message: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/rag/search', async (request, reply) => {
    const parsed = SearchBody.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_search', issues: parsed.error.issues };
    }

    try {
      const result = await retrieveContext(parsed.data.query);
      return reply.send({ results: result.chunks, documentsSearched: result.documentsSearched });
    } catch (err: unknown) {
      if (err instanceof ProviderError) {
        return reply.status(503).send({ error: 'embed_provider_unavailable', message: err.message });
      }
      return reply.status(500).send({ error: 'search_failed', message: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/rag', async (_request, reply) => {
    vectorStore.reset();
    return reply.send({ ok: true, message: 'RAG index cleared', stats: vectorStore.stats() });
  });

  app.get('/rag/stats', async () => {
    return vectorStore.stats();
  });
}

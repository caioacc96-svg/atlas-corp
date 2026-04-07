import type { ChatMessage } from '../../../src/shared/types';
import { getAtlasConfig } from '../config/atlas-config';
import { atlasSystemPrompt } from './atlasPrompt';
import { AtlasProviderError } from './llm/errors';

export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface StreamOptions {
  systemPrompt?: string;
}

const PROVIDER_URL = `${process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1'}/chat/completions`;

export function getProviderConfig(): ProviderConfig {
  return {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.ATLAS_MODEL || 'qwen/qwen3.6-plus:free',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1',
  };
}

export type SimpleMessage = { role: string; content: string };

function buildMessages(messages: SimpleMessage[], systemPrompt?: string) {
  return [
    { role: 'system' as const, content: systemPrompt ?? atlasSystemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}

async function callProviderStream(messages: Array<{ role: string; content: string }>) {
  const { apiKey, model } = getProviderConfig();

  const response = await fetch(PROVIDER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://atlas-corp.local',
      'X-Title': 'Atlas Corp',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal: AbortSignal.timeout(getAtlasConfig().streamTimeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new AtlasProviderError({
      provider: 'openrouter',
      model,
      phase: 'stream_connect',
      isRetryable: response.status >= 500 || response.status === 429,
      originalMessage: `${response.status} ${text}`,
    });
  }

  return response;
}

async function callProviderNonStream(messages: Array<{ role: string; content: string }>) {
  const { apiKey, model } = getProviderConfig();

  const response = await fetch(PROVIDER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://atlas-corp.local',
      'X-Title': 'Atlas Corp',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
    signal: AbortSignal.timeout(getAtlasConfig().nonStreamTimeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new AtlasProviderError({
      provider: 'openrouter',
      model,
      phase: 'non_stream',
      isRetryable: response.status >= 500 || response.status === 429,
      originalMessage: `${response.status} ${text}`,
    });
  }

  return await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
}

export async function* generateResponse(messages: SimpleMessage[], opts?: StreamOptions) {
  const { apiKey, model } = getProviderConfig();
  if (!apiKey) {
    throw new AtlasProviderError({
      provider: 'openrouter',
      model,
      phase: 'stream_connect',
      isRetryable: false,
      originalMessage: 'OPENAI_API_KEY não configurada no backend do Atlas.',
    });
  }

  const formattedMessages = buildMessages(messages, opts?.systemPrompt);

  let gotContent = false;

  try {
    const response = await callProviderStream(formattedMessages);
    if (!response.body) throw new AtlasProviderError({
      provider: 'openrouter', model, phase: 'stream_connect',
      originalMessage: 'No response body',
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      while (buffer.includes('\n')) {
        const index = buffer.indexOf('\n');
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);

        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;

        try {
          const chunk = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
            error?: { message?: string };
          };

          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            gotContent = true;
            yield { type: 'delta' as const, delta };
          }

          if (chunk.choices?.[0]?.finish_reason) return;
          if (chunk.error) throw new AtlasProviderError({
            provider: 'openrouter', model, phase: 'stream_read',
            originalMessage: chunk.error.message ?? 'Provider error',
          });
        } catch (e) {
          if (e instanceof AtlasProviderError) throw e;
          // Skip parse errors for malformed SSE lines
        }
      }
    }

    // If stream connected but no content, use fallback explicitly
    if (!gotContent && getAtlasConfig().stallFallbackEnabled) {
      console.log('[ATLAS][LLM] Stream stalled, falling back to non-streaming');
      try {
        const result = await callProviderNonStream(formattedMessages);
        const text = result.choices?.[0]?.message?.content ?? '';
        if (text) {
          yield { type: 'delta' as const, delta: text };
        }
        return;
      } catch (fallbackErr) {
        // Both failed — throw a structured error
        throw new AtlasProviderError({
          provider: 'openrouter', model, phase: 'non_stream',
          originalMessage: `Stream stall fallback also failed: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
        });
      }
    }
  } catch (err) {
    if (err instanceof AtlasProviderError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new AtlasProviderError({
      provider: 'openrouter', model, phase: 'stream_read',
      originalMessage: message,
    });
  }
}

export { atlasSystemPrompt as SYSTEM_PROMPT };

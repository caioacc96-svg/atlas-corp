import type { Provider, ChatRequest, ChatResponse, EmbedRequest, EmbedResponse, StreamChunk } from '../types';
import { ProviderError } from '../errors';
import { getAtlasConfig } from '../../../config/atlas-config';

const PROVIDER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// --- OpenRouter API response shapes (minimal, for type safety) ---

type OpenRouterChatResponse = {
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  choices?: Array<{ message?: { content?: unknown } }>;
};

type OpenRouterEmbedResponse = {
  data?: Array<{ embedding?: unknown }>;
  model?: string;
};

function headers(): Record<string, string> {
  const cfg = getAtlasConfig();
  if (!cfg.openrouterApiKey) {
    throw new ProviderError('openrouter', 'OPENROUTER_API_KEY missing; remote provider disabled', undefined, false);
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.openrouterApiKey}`,
    'HTTP-Referer': cfg.openrouterSiteUrl,
    'X-Title': cfg.openrouterSiteName,
  };
}

export class OpenRouterProvider implements Provider {
  readonly id = 'openrouter';
  readonly displayName = 'OpenRouter';
  readonly supportsChat = true;
  readonly supportsEmbed = true;
  readonly supportsStreaming = true;

  async probe(): Promise<boolean> {
    const cfg = getAtlasConfig();
    if (!cfg.openrouterApiKey) return false;
    try {
      const res = await fetch(`${cfg.openaiBaseUrl}/models`, {
        method: 'GET',
        headers: headers(),
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const cfg = getAtlasConfig();
    const model = req.model ?? cfg.remoteModel;
    const t0 = Date.now();

    let res: Response;
    try {
      res = await fetch(PROVIDER_URL, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          model,
          messages: req.messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 1024,
          stream: false,
        }),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ProviderError(this.id, `Network error: ${msg}`, undefined, true);
    }

    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch { /* ignore */ }
      const retryable = res.status === 429 || res.status >= 500;
      throw new ProviderError(this.id, `HTTP ${res.status}: ${body.slice(0, 200)}`, res.status, retryable);
    }

    const data: unknown = await res.json().catch(() => null);
    const parsed = data as OpenRouterChatResponse;
    if (parsed === null) {
      throw new ProviderError(this.id, 'Invalid JSON in response');
    }

    const content = parsed?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new ProviderError(this.id, 'Unexpected response shape');
    }

    return {
      content,
      model: parsed.model ?? model,
      provider: this.id,
      promptTokens: parsed.usage?.prompt_tokens,
      completionTokens: parsed.usage?.completion_tokens,
      latencyMs: Date.now() - t0,
    };
  }

  async *stream(req: ChatRequest): AsyncGenerator<StreamChunk> {
    const cfg = getAtlasConfig();
    const model = req.model ?? cfg.remoteModel;

    let res: Response;
    try {
      res = await fetch(PROVIDER_URL, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          model,
          messages: req.messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 1024,
          stream: true,
        }),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ProviderError(this.id, `Stream network error: ${msg}`, undefined, true);
    }

    if (!res.ok || !res.body) {
      let body = '';
      try { body = await res.text(); } catch { /* ignore */ }
      const retryable = res.status === 429 || res.status >= 500;
      throw new ProviderError(this.id, `Stream HTTP ${res.status}: ${body.slice(0, 200)}`, res.status, retryable);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';

      for (const raw of parts) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          yield { content: '', done: true, provider: this.id, model };
          return;
        }
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: unknown } }>;
            model?: string;
          };
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            yield { content: delta, provider: this.id, model: parsed.model ?? model };
          }
        } catch {
          // ignore malformed lines
        }
      }
    }

    yield { content: '', done: true, provider: this.id, model };
  }

  async embed(req: EmbedRequest): Promise<EmbedResponse> {
    const cfg = getAtlasConfig();
    if (!cfg.openrouterApiKey) {
      throw new ProviderError(this.id, 'OPENROUTER_API_KEY not configured for embeddings', undefined, false);
    }

    const embedModel = req.model ?? 'text-embedding-3-small';

    const results: number[][] = [];
    for (const text of req.texts) {
      let res: Response;
      try {
        res = await fetch('https://openrouter.ai/api/v1/embeddings', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ model: embedModel, input: text }),
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new ProviderError(this.id, `Embed network error: ${msg}`, undefined, true);
      }

      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        const retryable = res.status === 429 || res.status >= 500;
        throw new ProviderError(this.id, `Embed HTTP ${res.status}: ${bodyText.slice(0, 200)}`, res.status, retryable);
      }

      const data: unknown = await res.json().catch(() => {
        throw new ProviderError(this.id, 'Invalid JSON in embed response');
      });
      if (data === null) {
        throw new ProviderError(this.id, 'Invalid JSON in embed response');
      }
      const parsed = data as OpenRouterEmbedResponse;

      const embedding = parsed?.data?.[0]?.embedding;
      if (!Array.isArray(embedding) || embedding.some((v: unknown) => typeof v !== 'number')) {
        throw new ProviderError(this.id, 'No embedding returned from OpenRouter');
      }

      results.push(embedding as number[]);
    }

    return { embeddings: results, model: embedModel, provider: this.id };
  }
}

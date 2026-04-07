import type { Provider, ChatRequest, ChatTaskType, ChatResponse, StreamChunk, EmbedRequest, EmbedResponse } from './types';
import { ProviderError, AllProvidersFailedError, isProviderError } from './errors';
import { computeScore, metricsStore } from './metrics-store';
import { getAtlasConfig } from '../../config/atlas-config';

// --- Embedding fallback ---

async function embedWithFallback(req: EmbedRequest, ollamaBase: string, ollamaTimeoutMs: number): Promise<EmbedResponse> {
  // Try Ollama first
  try {
    const res = await fetch(`${ollamaBase}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', input: req.texts }),
      signal: AbortSignal.timeout(ollamaTimeoutMs),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderError('ollama', `Embed HTTP ${res.status}: ${body.slice(0, 200)}`, res.status, res.status === 404 || body.toLowerCase().includes('not found'));
    }

    const data: unknown = await res.json();
    const record = data as Record<string, unknown>;
    const embeddings = record?.embeddings as number[][] | undefined;
    if (!Array.isArray(embeddings) || embeddings.length === 0) {
      throw new ProviderError('ollama', 'No embeddings returned from Ollama');
    }
    // Ollama succeeded
    return { embeddings, model: (record.model as string) ?? 'nomic-embed-text', provider: 'ollama' };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[embed-fallback] Ollama failed, trying OpenRouter: ${errMsg}`);
  }

  // Try OpenRouter fallback
  const cfg = getAtlasConfig();
  if (!cfg.openrouterApiKey) {
    const msg = 'No embed provider available. Start Ollama or set OPENROUTER_API_KEY for fallback.';
    console.error(`[embed-fallback] ${msg}`);
    throw new ProviderError('router', msg, undefined, false);
  }

  console.log('[embed-fallback] Falling back to OpenRouter embeddings');

  const results: number[][] = [];
  const embedModel = 'text-embedding-3-small';

  for (const text of req.texts) {
    let res: Response;
    try {
      res = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.openrouterApiKey}`,
          'HTTP-Referer': cfg.openrouterSiteUrl,
          'X-Title': cfg.openrouterSiteName,
        },
        body: JSON.stringify({ model: embedModel, input: text }),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[embed-fallback] OpenRouter network error: ${msg}`);
      throw new ProviderError('openrouter-embed-fallback', `Embed network error: ${msg}`, undefined, true);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[embed-fallback] OpenRouter HTTP ${res.status}: ${body.slice(0, 200)}`);
      throw new ProviderError('openrouter-embed-fallback', `Embed HTTP ${res.status}: ${body.slice(0, 200)}`, res.status, res.status === 429 || res.status >= 500);
    }

    const data: unknown = await res.json().catch(() => {
      throw new ProviderError('openrouter-embed-fallback', 'Invalid JSON in embed response');
    });
    const record = data as Record<string, unknown>;
    const embedding = (record as Record<string, any>)?.data?.[0]?.embedding as number[] | undefined;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new ProviderError('openrouter-embed-fallback', 'No embedding returned from OpenRouter');
    }

    results.push(embedding);
  }

  console.log(`[embed-fallback] OpenRouter embeddings OK (${results.length} vectors)`);
  return { embeddings: results, model: embedModel, provider: 'openrouter-fallback' };
}

// --- Task classification ---

export function classifyTask(req: ChatRequest): ChatTaskType {
  if (req.useRag) return 'chat_with_rag';
  const text = req.messages.map((m) => m.content).join('\n').toLowerCase();
  if (/```|typescript|javascript|python|sql|bash|code|refactor|debug|function\s+\w+\(|=>\s*\{|const\s+\w+\s*=\s*function|class\s+\w+|import\s+\{|export\s+(default|const|function|class|interface|type)\s/.test(text)) return 'code_generation';
  if (text.length > 6000 || (req.maxTokens ?? 0) > 1800) return 'long_generation';
  return 'chat_simple';
}

// --- Router ---

export class ProviderRouter {
  private providers: Provider[] = [];

  register(provider: Provider): void {
    this.providers.push(provider);
  }

  getAll(): Provider[] {
    return [...this.providers];
  }

  getById(id: string): Provider | undefined {
    return this.providers.find((p) => p.id === id);
  }

  getEmbedProvider(): Provider {
    const provider = this.providers.find((p) => p.supportsEmbed);
    if (!provider) {
      throw new ProviderError('router', 'No embed-capable provider registered. Ensure Ollama is running and configured.');
    }
    return provider;
  }

  classifyTask(req: ChatRequest): ChatTaskType {
    return req.taskType ?? classifyTask(req);
  }

  decide(req: ChatRequest, preferredProviderId?: string): {
    taskType: ChatTaskType;
    orderedProviderIds: string[];
    scoreByProvider: Record<string, number>;
  } {
    const cfg = getAtlasConfig();
    const taskType = this.classifyTask(req);
    const chatProviders = this.providers.filter((p) => p.supportsChat);
    const scoreByProvider: Record<string, number> = {};

    for (const provider of chatProviders) {
      scoreByProvider[provider.id] = computeScore(provider.id, {
        taskType,
        preferStreaming: !!req.stream,
      });
    }

    let ordered = [...chatProviders].sort((a, b) => (scoreByProvider[b.id] ?? 0) - (scoreByProvider[a.id] ?? 0));

    // Mode-based filtering
    const mode = cfg.atlasMode;
    if (mode === 'local_only') {
      ordered = ordered.filter((p) => p.id === 'ollama');
    } else if (mode === 'remote_only') {
      ordered = ordered.filter((p) => p.id === 'openrouter');
    } else if (mode === 'hybrid_prefer_local') {
      ordered.sort((a, b) => {
        const aBonus = a.id === 'ollama' ? 0.5 : 0;
        const bBonus = b.id === 'ollama' ? 0.5 : 0;
        return (scoreByProvider[b.id] ?? 0) + bBonus - ((scoreByProvider[a.id] ?? 0) + aBonus);
      });
    } else if (mode === 'hybrid_prefer_remote') {
      ordered.sort((a, b) => {
        const aBonus = a.id === 'openrouter' ? 0.5 : 0;
        const bBonus = b.id === 'openrouter' ? 0.5 : 0;
        return (scoreByProvider[b.id] ?? 0) + bBonus - ((scoreByProvider[a.id] ?? 0) + aBonus);
      });
    }

    // Override: preferred provider goes first if available
    if (preferredProviderId) {
      const preferred = ordered.find((p) => p.id === preferredProviderId);
      if (preferred) {
        ordered = [preferred, ...ordered.filter((p) => p.id !== preferredProviderId)];
      }
    }

    return {
      taskType,
      orderedProviderIds: ordered.map((p) => p.id),
      scoreByProvider,
    };
  }

  async chat(req: ChatRequest, preferredProviderId?: string): Promise<ChatResponse> {
    const { taskType, orderedProviderIds } = this.decide(req, preferredProviderId);
    const ordered = orderedProviderIds
      .map((id) => this.getById(id))
      .filter((p): p is Provider => Boolean(p));

    if (ordered.length === 0) {
      throw new AllProvidersFailedError({ router: 'No chat providers registered or available in current mode' });
    }

    const errors: Record<string, string> = {};

    for (const provider of ordered) {
      const score = computeScore(provider.id, { taskType, preferStreaming: false });
      const scoreStr = score.toFixed(3);

      try {
        const result = await provider.chat({ ...req, taskType });
        metricsStore.recordSuccess(provider.id, result.latencyMs, taskType, false);
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors[provider.id] = msg;
        metricsStore.recordFailure(provider.id, false);
        if (!isProviderError(err) || !(err instanceof ProviderError && err.retryable)) {
          // Stop trying if error is not retryable
          continue;
        }
      }
    }

    throw new AllProvidersFailedError(errors);
  }

  async stream(
    req: ChatRequest,
    preferredProviderId?: string,
    onChunk?: (chunk: StreamChunk) => Promise<void> | void,
  ): Promise<ChatResponse> {
    const { taskType, orderedProviderIds } = this.decide(req, preferredProviderId);
    console.log(`[router] stream decided: taskType=${taskType}, providers=[${orderedProviderIds.join(', ')}]`);
    const ordered = orderedProviderIds
      .map((id) => this.getById(id))
      .filter((p): p is Provider => Boolean(p));

    if (ordered.length === 0) {
      throw new AllProvidersFailedError({ router: 'No streaming providers registered or available' });
    }

    const errors: Record<string, string> = {};

    for (const provider of ordered) {
      if (!provider.supportsStreaming) {
        errors[provider.id] = `[${provider.id}] Streaming not supported`;
        continue;
      }

      const startedAt = Date.now();
      let content = '';

      try {
        for await (const chunk of provider.stream({ ...req, stream: true, taskType })) {
          if (chunk.content) {
            content += chunk.content;
            if (onChunk) await onChunk(chunk);
          }
        }

        const response: ChatResponse = {
          content,
          model: req.model ?? provider.id,
          provider: provider.id,
          latencyMs: Date.now() - startedAt,
        };
        metricsStore.recordSuccess(provider.id, response.latencyMs, taskType, true);
        return response;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors[provider.id] = msg;
        metricsStore.recordFailure(provider.id, true);
      }
    }

    throw new AllProvidersFailedError(errors);
  }

  async embed(req: EmbedRequest): Promise<EmbedResponse> {
    const cfg = getAtlasConfig();
    return embedWithFallback(req, cfg.ollamaBaseUrl, cfg.ollamaTimeoutMs);
  }

  embedDirect(req: EmbedRequest): Promise<EmbedResponse> {
    const provider = this.getEmbedProvider();
    return provider.embed(req);
  }

  scores(taskType?: ChatTaskType): Record<string, number> {
    const out: Record<string, number> = {};
    for (const p of this.providers) out[p.id] = computeScore(p.id, { taskType });
    return out;
  }
}

// --- Singleton ---

export const router = new ProviderRouter();

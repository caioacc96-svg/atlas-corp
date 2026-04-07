import type { Provider, ChatRequest, ChatResponse, EmbedRequest, EmbedResponse, StreamChunk } from '../types';
import { ProviderError } from '../errors';
import { getAtlasConfig } from '../../../config/atlas-config';

export class OllamaProvider implements Provider {
  readonly id = 'ollama';
  readonly displayName = 'Ollama (local)';
  readonly supportsChat = true;
  readonly supportsEmbed = true;
  readonly supportsStreaming = true;

  private get base(): string {
    return getAtlasConfig().ollamaBaseUrl;
  }

  private get model(): string {
    return getAtlasConfig().localModel;
  }

  private get timeout(): number {
    return getAtlasConfig().ollamaTimeoutMs;
  }

  async probe(): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/api/tags`, {
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const model = req.model ?? this.model;
    const t0 = Date.now();

    let res: Response;
    try {
      // Forge: use /api/chat (multi-role, modern) — NOT /api/generate
      res = await fetch(`${this.base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: req.messages,
          stream: false,
          options: {
            temperature: req.temperature ?? 0.7,
            num_predict: req.maxTokens ?? 1024,
          },
        }),
        signal: AbortSignal.timeout(this.timeout),
      });
    } catch (err: unknown) {
      throw this.toNetworkError(err);
    }

    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch { /* ignore */ }
      throw new ProviderError(this.id, `HTTP ${res.status}: ${body.slice(0, 200)}`, res.status);
    }

    const data: unknown = await res.json().catch(() => null);
    if (data === null) {
      throw new ProviderError(this.id, 'Invalid JSON in response');
    }
    const record = data as Record<string, unknown>;
    const message = record?.message as Record<string, unknown> | undefined;
    const content: string = (message?.content as string) ?? (record?.response as string) ?? '';
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new ProviderError(this.id, `Model "${model}" may not be pulled. Run: ollama pull ${model}`);
    }

    return {
      content: content.trim(),
      model: (record.model as string | undefined) ?? model,
      provider: this.id,
      latencyMs: Date.now() - t0,
    };
  }

  async *stream(req: ChatRequest): AsyncGenerator<StreamChunk> {
    const model = req.model ?? this.model;

    // Forge: use /api/chat with messages[] — NOT /api/generate
    let res: Response;
    try {
      res = await fetch(`${this.base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: req.messages,
          stream: true,
          options: {
            temperature: req.temperature ?? 0.7,
            num_predict: req.maxTokens ?? 1024,
          },
        }),
        signal: AbortSignal.timeout(this.timeout),
      });
    } catch (err: unknown) {
      throw this.toNetworkError(err);
    }

    if (!res.ok || !res.body) {
      let body = '';
      try { body = await res.text(); } catch { /* ignore */ }
      throw new ProviderError(this.id, `Stream HTTP ${res.status}: ${body.slice(0, 200)}`, res.status);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        try {
          const parsed = JSON.parse(line);
          // /api/chat returns message.content
          const delta = parsed?.message?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            yield { content: delta, provider: this.id, model: parsed.model ?? model };
          }
          if (parsed.done) {
            yield { content: '', done: true, provider: this.id, model: parsed.model ?? model };
            return;
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }

    yield { content: '', done: true, provider: this.id, model };
  }

  async embed(req: EmbedRequest): Promise<EmbedResponse> {
    const cfg = getAtlasConfig();
    const model = req.model ?? cfg.embedModel;
    const embeddings: number[][] = [];

    // Forge: use /api/embed (batch) — NOT /api/embeddings
    let res: Response;
    try {
      res = await fetch(`${this.base}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: req.texts }),
        signal: AbortSignal.timeout(this.timeout),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        throw new ProviderError(this.id, `Ollama not running at ${this.base}. RAG embeddings unavailable.`);
      }
      throw new ProviderError(this.id, `Embed network error: ${msg}`, undefined, true);
    }

    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch { /* ignore */ }
      const modelMissing = res.status === 404 || body.toLowerCase().includes('not found') || body.toLowerCase().includes('pull');
      throw new ProviderError(
        this.id,
        modelMissing
          ? `Model "${model}" not found for embeddings. Run: ollama pull ${model}`
          : `Embed HTTP ${res.status}: ${body.slice(0, 200)}`,
        res.status,
      );
    }

    let data: any;
    try { data = await res.json(); } catch {
      throw new ProviderError(this.id, 'Invalid JSON in embed response');
    }

    if (!Array.isArray(data?.embeddings) || data.embeddings.length === 0) {
      throw new ProviderError(this.id, `No embeddings returned for model "${model}"`);
    }

    return { embeddings: data.embeddings, model, provider: this.id };
  }

  private toNetworkError(err: unknown): ProviderError {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      return new ProviderError(this.id, `Ollama is not running at ${this.base}. Start with: ollama serve`, undefined, false);
    }
    return new ProviderError(this.id, `Network error: ${msg}`, undefined, true);
  }
}

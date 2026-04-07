import { ProviderAdapter, ProviderGenerateInput, ProviderGenerateOutput, ProviderKind } from './contracts';

export class OpenAIProvider implements ProviderAdapter {
  readonly name: ProviderKind = 'openai';

  constructor(private readonly config: { apiKey: string; baseUrl?: string }) {}

  async healthcheck() {
    return { ok: Boolean(this.config.apiKey), detail: this.config.apiKey ? 'configured' : 'missing api key' };
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    const baseUrl = this.config.baseUrl ?? 'https://api.openai.com/v1';
    if (!this.config.apiKey) {
      throw new Error('OPENAI_API_KEY ausente no atlas-core');
    }

    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        input: [
          ...(input.system ? [{ role: 'system', content: input.system }] : []),
          ...input.messages,
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI provider failed: ${response.status} ${await response.text()}`);
    }

    const raw = await response.json();
    const text = typeof raw?.output_text === 'string' ? raw.output_text : JSON.stringify(raw);
    return { text, raw };
  }
}

export class OllamaProvider implements ProviderAdapter {
  readonly name: ProviderKind = 'ollama';

  constructor(private readonly config: { baseUrl?: string }) {}

  async healthcheck() {
    try {
      const res = await fetch(`${this.config.baseUrl ?? 'http://127.0.0.1:11434'}/api/tags`);
      return { ok: res.ok, detail: res.ok ? 'reachable' : `http ${res.status}` };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) };
    }
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    const baseUrl = this.config.baseUrl ?? 'http://127.0.0.1:11434';
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: input.model,
        messages: [
          ...(input.system ? [{ role: 'system', content: input.system }] : []),
          ...input.messages,
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama provider failed: ${response.status} ${await response.text()}`);
    }

    const raw = await response.json();
    return {
      text: raw?.message?.content ?? '',
      raw,
    };
  }
}

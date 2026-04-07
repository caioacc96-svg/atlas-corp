import { describe, it, expect, beforeEach } from 'vitest';
import { classifyTask, ProviderRouter } from './router';
import type { Provider, ChatRequest, ChatResponse, EmbedRequest, EmbedResponse, StreamChunk } from './types';

// Mock provider factory
function mockProvider(id: string, chatSuccess = true): Provider {
  return {
    id,
    displayName: id,
    supportsChat: true,
    supportsEmbed: true,
    supportsStreaming: true,
    probe: async () => true,
    chat: async (req: ChatRequest) => {
      if (!chatSuccess) throw new Error(`${id} chat failed`);
      return { content: `hello from ${id}`, model: id, provider: id, latencyMs: 100 };
    },
    async *stream(req: ChatRequest): AsyncGenerator<StreamChunk> {
      if (!chatSuccess) throw new Error(`${id} stream failed`);
      yield { content: 'hello', done: true, provider: id, model: id };
    },
    embed: async (req: EmbedRequest): Promise<EmbedResponse> => {
      return {
        embeddings: req.texts.map(() => [1, 2, 3]),
        model: id,
        provider: id,
      };
    },
  };
}

describe('classifyTask', () => {
  it('should classify simple chat', () => {
    const type = classifyTask({ messages: [{ role: 'user', content: 'Olá, como vai?' }] });
    expect(type).toBe('chat_simple');
  });

  it('should classify chat with RAG', () => {
    const type = classifyTask({ messages: [{ role: 'user', content: 'O que é RAG?' }], useRag: true });
    expect(type).toBe('chat_with_rag');
  });

  it('should classify long generation', () => {
    const type = classifyTask({ messages: [{ role: 'user', content: 'x'.repeat(7000) }] });
    expect(type).toBe('long_generation');
  });

  it('should classify code generation', () => {
    const type = classifyTask({ messages: [{ role: 'user', content: 'function hello() {\n  return true;\n}' }] });
    expect(type).toBe('code_generation');
  });
});

describe('ProviderRouter', () => {
  it('should register and list providers', () => {
    const router = new ProviderRouter();
    router.register(mockProvider('ollama'));
    router.register(mockProvider('openrouter'));
    expect(router.getAll().length).toBe(2);
    expect(router.getById('ollama')).toBeDefined();
  });

  it('should decide provider order', () => {
    const router = new ProviderRouter();
    router.register(mockProvider('ollama'));
    router.register(mockProvider('openrouter'));

    const decision = router.decide({ messages: [{ role: 'user', content: 'hello' }] });
    expect(decision.orderedProviderIds.length).toBe(2);
    expect(decision.taskType).toBe('chat_simple');
    expect(decision.scoreByProvider['ollama']).toBeDefined();
  });

  it('should chat successfully', async () => {
    const router = new ProviderRouter();
    router.register(mockProvider('ollama'));

    const result = await router.chat({ messages: [{ role: 'user', content: 'hello' }] });
    expect(result.provider).toBe('ollama');
    expect(result.content).toBe('hello from ollama');
  });

  it('should fallback to second provider', async () => {
    const router = new ProviderRouter();
    router.register(mockProvider('openrouter', false)); // will fail
    router.register(mockProvider('ollama')); // will succeed

    const result = await router.chat({ messages: [{ role: 'user', content: 'hello' }] });
    expect(result.provider).toBe('ollama');
  });

  it('should stream successfully', async () => {
    const router = new ProviderRouter();
    router.register(mockProvider('ollama'));

    let content = '';
    const result = await router.stream(
      { messages: [{ role: 'user', content: 'hello' }] },
      undefined,
      async (chunk) => {
        if (chunk.content) content += chunk.content;
      }
    );
    expect(result.provider).toBe('ollama');
    expect(content).toBe('hello');
  });

  it('should throw when no providers registered', async () => {
    const router = new ProviderRouter();
    try {
      await router.chat({ messages: [] });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).toContain('No chat providers');
    }
  });

  it('should return scores', () => {
    const router = new ProviderRouter();
    router.register(mockProvider('ollama'));
    const scores = router.scores();
    expect(scores['ollama']).toBeDefined();
  });
});

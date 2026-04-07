import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAtlasConfig, resolveModelFor, resolveEmbedConfig, resetConfig } from './atlas-config';

describe('atlas-config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    resetConfig();
  });

  it('should return defaults when no env vars are set', () => {
    // Clear all atlas-related env vars
    delete process.env.ATLAS_MODE;
    delete process.env.ATLAS_PROVIDER_DEFAULT;
    delete process.env.ATLAS_ROUTER_STRATEGY;
    delete process.env.ATLAS_MODEL;
    delete process.env.ATLAS_REMOTE_MODEL;
    delete process.env.ATLAS_LOCAL_MODEL;
    delete process.env.ATLAS_EMBED_PROVIDER;
    delete process.env.ATLAS_EMBED_MODEL;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ATLAS_RAG_ENABLED;
    delete process.env.ATLAS_RAG_TOP_K;
    delete process.env.ATLAS_RAG_SCORE_THRESHOLD;

    const cfg = getAtlasConfig();
    expect(cfg.atlasMode).toBe('hybrid_prefer_local');
    expect(cfg.providerDefault).toBe('openrouter');
    expect(cfg.routerStrategy).toBe('latency_first');
    expect(cfg.embedProvider).toBe('ollama');
    expect(cfg.embedModel).toBe('nomic-embed-text');
    expect(cfg.ollamaBaseUrl).toBe('http://localhost:11434');
    expect(cfg.streamTimeoutMs).toBe(25000);
    expect(cfg.nonStreamTimeoutMs).toBe(45000);
    expect(cfg.ragEnabled).toBe(true);
    expect(cfg.ragTopK).toBe(3);
  });

  it('should read models from env vars', () => {
    process.env.ATLAS_REMOTE_MODEL = 'anthropic/claude-3.5-sonnet';
    process.env.ATLAS_LOCAL_MODEL = 'llama3.1:8b';
    process.env.ATLAS_EMBED_MODEL = 'mxbai-embed-large';

    const cfg = getAtlasConfig();
    expect(cfg.remoteModel).toBe('anthropic/claude-3.5-sonnet');
    expect(cfg.localModel).toBe('llama3.1:8b');
    expect(cfg.embedModel).toBe('mxbai-embed-large');
  });

  it('should resolve remote model', () => {
    process.env.ATLAS_REMOTE_MODEL = 'openai/gpt-4';
    const model = resolveModelFor('remote');
    expect(model).toBe('openai/gpt-4');
  });

  it('should resolve local model', () => {
    process.env.ATLAS_LOCAL_MODEL = 'mistral';
    const model = resolveModelFor('local');
    expect(model).toBe('mistral');
  });

  it('should resolve ollama embed config', () => {
    const embed = resolveEmbedConfig();
    expect(embed.provider).toBe('ollama');
    expect(embed.url).toContain('11434');
    expect(embed.apiKey).toBe('');
  });

  it('should resolve openrouter embed config when configured', () => {
    process.env.ATLAS_EMBED_PROVIDER = 'openrouter';
    process.env.OPENAI_API_KEY = 'test-key';
    const embed = resolveEmbedConfig();
    expect(embed.provider).toBe('openrouter');
    expect(embed.apiKey).toBe('test-key');
  });
});

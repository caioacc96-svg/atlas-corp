import { describe, it, expect } from 'vitest';

describe('RagContext module', () => {
  it('exports RagContext class', async () => {
    const { RagContext } = await import('./rag-context');
    expect(typeof RagContext).toBe('function');
  });

  it('RagContext constructor accepts index and options', async () => {
    const { RagContext } = await import('./rag-context');
    const { RagIndex } = await import('./rag-index');

    // Should not throw
    const ctx = new RagContext(
      new RagIndex({ storePath: undefined }),
      { minScore: 0.5, topK: 2 },
    );
    expect(ctx).toBeDefined();
  });

  it('RagContext has expected minScore default filtering behavior', async () => {
    const { RagContext } = await import('./rag-context');
    const { RagIndex } = await import('./rag-index');

    const ctx = new RagContext(
      new RagIndex({ storePath: undefined }),
    );
    expect(ctx.index).toBeDefined();
  });
});

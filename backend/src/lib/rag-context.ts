import { RagIndex } from './rag-index';
import { resolveEmbedConfig } from '../config/atlas-config';

/**
 * RAG context builder.
 * Takes a user query, retrieves relevant chunks from the index,
 * and returns a formatted context string ready to inject into the LLM system prompt.
 */

export type RagContextResult = {
  /** The formatted contextual preamble to prepend, or empty string if nothing found. */
  preamble: string;
  /** Raw retrieved chunks for debugging/logging. */
  chunks: Array<{ id: string; text: string; score: number }>;
  /** Whether any RAG context was found at all. */
  used: boolean;
};

const DEFAULT_MIN_SCORE = 0.3;
const DEFAULT_TOP_K = 3;

export class RagContext {
  readonly index: RagIndex;
  private minScore: number;
  private topK: number;

  constructor(index: RagIndex, opts?: { minScore?: number; topK?: number }) {
    this.index = index;
    this.minScore = opts?.minScore ?? DEFAULT_MIN_SCORE;
    this.topK = opts?.topK ?? DEFAULT_TOP_K;
  }

  /**
   * Build RAG context for a given query.
   * Returns a preamble string that can be injected into the system message.
   */
  async build(query: string): Promise<RagContextResult> {
    const results = await this.index.search(query, this.topK);

    // Filter low-relevance chunks
    const relevant = results.filter((r) => r.score >= this.minScore);

    if (relevant.length === 0) {
      return { preamble: '', chunks: [], used: false };
    }

    const preamble = buildContextPreamble(relevant);
    const chunks = relevant.map((r) => ({ id: r.id, text: r.text, score: r.score }));

    return { preamble, chunks, used: true };
  }
}

function buildContextPreamble(
  chunks: Array<{ id: string; text: string; score: number }>,
): string {
  const lines = [
    '\n--- Relevant Context (retrieved from your knowledge base) ---',
  ];

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    lines.push(
      `\n[${i + 1}] (relevance: ${c.score.toFixed(2)})\n${c.text}`,
    );
  }

  lines.push(
    '\n--- End of retrieved context ---',
    '\nUse this context only when it directly helps answer the user. Ignore it if irrelevant.',
  );

  return lines.join('\n');
}

/**
 * Factory: creates a preconfigured RagContext using centralized config.
 */
export function createRagContext(): RagContext {
  const embed = resolveEmbedConfig();
  return new RagContext(new RagIndex({
    embeddingApiUrl: embed.url,
    embeddingApiKey: embed.apiKey,
    embeddingModel: embed.model,
  }));
}

// Export singleton for reuse across requests
let singleton: RagContext | null = null;
export function getRagContext(): RagContext {
  if (!singleton) {
    singleton = createRagContext();
  }
  return singleton;
}

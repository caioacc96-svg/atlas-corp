import { RagIndex } from './rag-index';
import { ProviderAdapter } from './contracts';

export type RagContextResult = {
  preamble: string;
  chunks: Array<{ id: string; text: string; score: number }>;
  used: boolean;
};

const DEFAULT_MIN_SCORE = 0.3;
const DEFAULT_TOP_K = 3;

export class RagContext {
  private index: RagIndex;
  private minScore: number;
  private topK: number;

  constructor(
    index: RagIndex,
    opts?: { minScore?: number; topK?: number },
  ) {
    this.index = index;
    this.minScore = opts?.minScore ?? DEFAULT_MIN_SCORE;
    this.topK = opts?.topK ?? DEFAULT_TOP_K;
  }

  async build(query: string): Promise<RagContextResult> {
    const results = await this.index.search(query, this.topK);
    const relevant = results.filter((r) => r.score >= this.minScore);

    if (relevant.length === 0) {
      return { preamble: '', chunks: [], used: false };
    }

    return {
      preamble: buildContextPreamble(relevant),
      chunks: relevant.map((r) => ({ id: r.id, text: r.text, score: r.score })),
      used: true,
    };
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
    lines.push(`\n[${i + 1}] (relevance: ${c.score.toFixed(2)})\n${c.text}`);
  }
  lines.push(
    '\n--- End of retrieved context ---',
    '\nUse this context only when it directly helps answer the user. Ignore it if irrelevant.',
  );
  return lines.join('\n');
}

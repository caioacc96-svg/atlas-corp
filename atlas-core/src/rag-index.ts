import * as path from 'node:path';
import os from 'node:os';
import { VectorStore } from './vector-store';
import { ProviderAdapter, ProviderGenerateInput } from './contracts';

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export interface Chunk {
  id: string;
  text: string;
  metadata: {
    source?: string;
    index: number;
    [key: string]: unknown;
  };
}

export function chunkText(
  text: string,
  opts: { maxTokens?: number; overlapTokens?: number } = {},
): Chunk[] {
  const maxTokens = opts.maxTokens ?? 500;
  const overlapTokens = opts.overlapTokens ?? 50;

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: Chunk[] = [];
  let chunkId = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = tokenize(paragraph);
    if (paragraphTokens.length <= maxTokens) {
      chunks.push({
        id: `chunk-${Date.now()}-${chunkId++}`,
        text: paragraphTokens.join(' '),
        metadata: { index: chunks.length },
      });
    } else {
      const sentences = splitSentences(paragraph);
      const packed = packSentences(sentences, maxTokens, overlapTokens);
      for (const c of packed) {
        chunks.push({
          id: `chunk-${Date.now()}-${chunkId++}`,
          text: c,
          metadata: { index: chunks.length },
        });
      }
    }
  }
  return chunks;
}

function splitSentences(text: string): string[] {
  return text.replace(/([.!?])\s+/g, '$1|||').split('|||').map((s) => s.trim()).filter(Boolean);
}

function packSentences(
  sentences: string[],
  maxTokens: number,
  overlapTokens: number,
): string[] {
  const result: string[] = [];
  let current: string[] = [];
  let currentTokenCount = 0;

  for (const sentence of sentences) {
    const tokens = tokenize(sentence);
    if (currentTokenCount + tokens.length > maxTokens && current.length > 0) {
      result.push(current.join(' '));
      const overlap: string[] = [];
      let overlapCount = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const t = tokenize(current[i]);
        if (overlapCount + t.length > overlapTokens) break;
        overlap.unshift(current[i]);
        overlapCount += t.length;
      }
      current = overlap;
      currentTokenCount = overlapCount;
    }
    current.push(sentence);
    currentTokenCount += tokens.length;
  }
  if (current.length > 0) result.push(current.join(' '));
  return result;
}

/**
 * Core RAG Index -- uses the ProviderAdapter to get embeddings.
 * We trick the provider by asking for embeddings via a custom endpoint
 * (same as backend, just using fetch directly since providers don't
 * expose embedding).
 */
export type RagIndexConfig = {
  storePath?: string;
  embeddingApiUrl?: string;
  embeddingApiKey?: string;
  embeddingModel?: string;
};

export class RagIndex {
  private store: VectorStore;
  private embeddingApiUrl: string;
  private embeddingApiKey: string;
  private embeddingModel: string;

  constructor(config: RagIndexConfig = {}) {
    this.store = new VectorStore(config.storePath);
    const base = config.storePath ?? path.join(
      process.env.APPDATA || os.homedir(),
      'AtlasCorp',
      'core',
      'rag-index.json',
    );
    if (!config.storePath) {
      // store was created with default path
    }
    this.embeddingApiUrl = config.embeddingApiUrl ?? 'https://openrouter.ai/api/v1/embeddings';
    this.embeddingApiKey = config.embeddingApiKey ?? '';
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-3-small';
  }

  async ingest(text: string, metadata?: { source?: string }): Promise<{ chunkCount: number }> {
    const chunks = chunkText(text);
    if (chunks.length === 0) return { chunkCount: 0 };

    for (const chunk of chunks) {
      if (metadata?.source) chunk.metadata.source = metadata.source;
    }

    const texts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(texts, {
      apiUrl: this.embeddingApiUrl,
      apiKey: this.embeddingApiKey,
      model: this.embeddingModel,
    });

    for (let i = 0; i < chunks.length; i++) {
      this.store.upsert(chunks[i].id, embeddings[i], {
        ...chunks[i].metadata,
        text: chunks[i].text,
      });
    }

    return { chunkCount: chunks.length };
  }

  async search(query: string, topK: number = 5): Promise<Array<{ id: string; text: string; score: number; metadata: Record<string, unknown> }>> {
    const [queryEmbed] = await embedTexts([query], {
      apiUrl: this.embeddingApiUrl,
      apiKey: this.embeddingApiKey,
      model: this.embeddingModel,
    });

    const hits = this.store.search(queryEmbed, topK);
    return hits.map((hit) => ({
      id: hit.entry.id,
      text: String(hit.entry.metadata.text ?? ''),
      score: hit.score,
      metadata: hit.entry.metadata,
    }));
  }

  reset(): void {
    this.store.deleteAll();
  }

  stats(): { count: number } {
    return { count: this.store.count() };
  }
}

async function embedTexts(
  texts: string[],
  opts: { apiUrl: string; apiKey: string; model: string },
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await fetch(opts.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: opts.model,
      input: texts,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  return data.data.map((d) => d.embedding);
}

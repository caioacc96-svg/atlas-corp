import * as fs from 'node:fs';
import * as path from 'node:path';
import { VectorStore } from './vector-store';

// --- Tokenizer ---

/**
 * Very simple word-level tokenizer. Splits on whitespace.
 * Not perfect but good enough for chunking heuristics with no deps.
 */
function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

// --- Chunking ---

export interface Chunk {
  id: string;
  text: string;
  metadata: {
    source?: string;
    index: number;
    [key: string]: unknown;
  };
}

/**
 * Split text into chunks of at most maxTokens tokens, with overlap tokens between chunks.
 * Strategy: split into paragraphs first, then sub-chunk large paragraphs at sentence boundaries.
 */
export function chunkText(
  text: string,
  opts: { maxTokens?: number; overlapTokens?: number } = {},
): Chunk[] {
  const maxTokens = opts.maxTokens ?? 500;
  const overlapTokens = opts.overlapTokens ?? 50;

  // Split into paragraphs (double newlines)
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
      // Sub-chunk large paragraphs at sentence boundaries
      const sentences = splitSentences(paragraph);
      const chunksFromParagraph = packSentences(sentences, maxTokens, overlapTokens);
      for (const sentChunk of chunksFromParagraph) {
        chunks.push({
          id: `chunk-${Date.now()}-${chunkId++}`,
          text: sentChunk,
          metadata: { index: chunks.length },
        });
      }
    }
  }

  return chunks;
}

function splitSentences(text: string): string[] {
  return (
    text
      .replace(/([.!?])\s+/g, '$1|||')
      .split('|||')
      .map((s) => s.trim())
      .filter(Boolean)
  );
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
      // Build overlap: last portion that fits within overlapTokens
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

  if (current.length > 0) {
    result.push(current.join(' '));
  }

  return result;
}

// --- Embedding ---

/**
 * Get embeddings for a batch of texts using OpenAI-compatible embeddings API.
 * Works with OpenRouter, OpenAI, and any OpenAI-compatible endpoint.
 */
export async function embedTexts(
  texts: string[],
  opts: { apiUrl: string; apiKey: string; model?: string },
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const isOllama = opts.apiUrl.includes('11434');
  const model = opts.model ?? (isOllama ? 'nomic-embed-text' : 'text-embedding-3-small');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey && !isOllama) {
    headers.Authorization = `Bearer ${opts.apiKey}`;
    headers['HTTP-Referer'] = 'https://atlas-corp.local';
    headers['X-Title'] = 'Atlas Corp';
  }

  const body = isOllama
    ? JSON.stringify({ model, input: texts })
    : JSON.stringify({ model, input: texts });

  const response = await fetch(opts.apiUrl, {
    method: 'POST',
    headers: await Promise.resolve(headers),
    body,
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as unknown;
  const obj = data as Record<string, unknown>;

  if (isOllama && Array.isArray(obj.embeddings)) {
    return obj.embeddings as number[][];
  }

  type OpenAIResponse = { data: Array<{ embedding: number[] }> };
  if (Array.isArray((obj as { data?: unknown }).data)) {
    return (obj as OpenAIResponse).data.map((d) => d.embedding);
  }

  throw new Error(`Unexpected embedding API response format`);
}

// --- Index ---

export type RagIndexConfig = {
  storePath?: string;
  embeddingApiUrl?: string;
  embeddingApiKey?: string;
  embeddingModel?: string;
};

export class RagIndex {
  private store: VectorStore;
  private config: Required<Omit<RagIndexConfig, 'embeddingApiKey'>> & { embeddingApiKey?: string };

  constructor(config: RagIndexConfig = {}) {
    this.store = new VectorStore(config.storePath);
    this.config = {
      storePath: config.storePath ?? this.defaultStorePath(),
      embeddingApiUrl: config.embeddingApiUrl ?? 'https://openrouter.ai/api/v1/embeddings',
      embeddingModel: config.embeddingModel ?? 'text-embedding-3-small',
      embeddingApiKey: config.embeddingApiKey,
    };
  }

  /**
   * Index a piece of text: chunk it, embed it, store embeddings.
   */
  async ingest(text: string, metadata?: { source?: string }): Promise<{ chunkCount: number }> {
    const chunks = chunkText(text);
    if (chunks.length === 0) return { chunkCount: 0 };

    // Add source metadata to all chunks
    for (const chunk of chunks) {
      if (metadata?.source) {
        chunk.metadata.source = metadata.source;
      }
    }

    const texts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(texts, {
      apiUrl: this.config.embeddingApiUrl,
      apiKey: this.config.embeddingApiKey ?? '',
      model: this.config.embeddingModel,
    });

    for (let i = 0; i < chunks.length; i++) {
      this.store.upsert(chunks[i].id, embeddings[i], {
        ...chunks[i].metadata,
        text: chunks[i].text,
      });
    }

    return { chunkCount: chunks.length };
  }

  /**
   * Search the index for similar text.
   */
  async search(query: string, topK: number = 5): Promise<Array<{ id: string; text: string; score: number; metadata: Record<string, unknown> }>> {
    const [queryEmbed] = await embedTexts([query], {
      apiUrl: this.config.embeddingApiUrl,
      apiKey: this.config.embeddingApiKey ?? '',
      model: this.config.embeddingModel,
    });

    const hits = this.store.search(queryEmbed, topK);
    return hits.map((hit) => ({
      id: hit.entry.id,
      text: String(hit.entry.metadata.text ?? ''),
      score: hit.score,
      metadata: hit.entry.metadata,
    }));
  }

  /**
   * Delete all indexed vectors.
   */
  reset(): void {
    this.store.deleteAll();
  }

  stats(): { count: number; filePath: string } {
    return {
      count: this.store.count(),
      filePath: this.config.storePath,
    };
  }

  private defaultStorePath(): string {
    return path.join(process.cwd(), 'data', 'rag-index.json');
  }
}

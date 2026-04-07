import { getAtlasConfig } from '../../config/atlas-config';
import type { ChatMessage } from './types';
import { ProviderError } from './errors';
import { vectorStore } from './vectorstore';
import { router } from './router';

export interface IngestResult {
  documentId: string;
  chunkCount: number;
  model: string;
}

export interface RetrievalResult {
  chunks: { text: string; score?: number }[];
  documentsSearched: number;
}

export interface RagAugmentationResult {
  messages: ChatMessage[];
  ragUsed: boolean;
  chunkCount: number;
  ragStatus: 'used' | 'empty' | 'unavailable' | 'failed';
  ragError?: string;
}

// --- Chunking ---

export interface TextChunk {
  text: string;
  index: number;
  charStart: number;
  charEnd: number;
}

export function chunkText(
  text: string,
  chunkSize?: number,
  overlap?: number,
): TextChunk[] {
  const cfg = getAtlasConfig();
  const size = chunkSize ?? cfg.ragChunkSize;
  const ov = overlap ?? cfg.ragChunkOverlap;

  const chunks: TextChunk[] = [];
  const words = text.split(/\s+/).filter(Boolean);
  let i = 0;
  let chunkIdx = 0;
  let charCursor = 0;

  while (i < words.length) {
    const slice = words.slice(i, i + size);
    const chunkText = slice.join(' ');
    const charStart = charCursor;
    const charEnd = charStart + chunkText.length;

    chunks.push({ text: chunkText, index: chunkIdx, charStart, charEnd });

    chunkIdx++;
    charCursor = charEnd + 1;
    i += size - ov;
    if (i <= 0) i = size; // safety guard
  }

  return chunks;
}

// --- Ingestion ---

export async function ingestDocument(
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<IngestResult> {
  if (!content || content.trim().length === 0) {
    throw new Error('Cannot ingest empty document');
  }

  const cfg = getAtlasConfig();
  const documentId = (metadata.documentId as string) ?? `doc-${Date.now()}`;

  const chunks = chunkText(content);
  if (chunks.length === 0) {
    throw new Error('Document produced no chunks after splitting');
  }

  const texts = chunks.map((c) => c.text);
  const embedRes = await router.embed({
    texts,
    model: cfg.embedModel,
  });

  await vectorStore.addBatch(
    chunks.map((chunk, i) => ({
      text: chunk.text,
      embedding: embedRes.embeddings[i],
      metadata: { ...metadata, documentId, chunkIndex: chunk.index },
    })),
  );

  await vectorStore.flush();

  return { documentId, model: embedRes.model, chunkCount: chunks.length };
}

// --- Retrieval ---

export async function retrieveContext(query: string): Promise<RetrievalResult> {
  const cfg = getAtlasConfig();

  if (vectorStore.count() === 0) {
    return { chunks: [], documentsSearched: 0 };
  }

  const embedRes = await router.embed({
    texts: [query],
    model: cfg.embedModel,
  });

  const queryEmbedding = embedRes.embeddings[0];
  const results = vectorStore.search(queryEmbedding, cfg.ragTopK, cfg.ragScoreThreshold);

  return {
    chunks: results.map((r) => ({ text: r.text, score: r.score })),
    documentsSearched: vectorStore.count(),
  };
}

// --- Augmentation ---

export async function augmentWithRAG(
  messages: ChatMessage[],
  userQuery: string,
): Promise<RagAugmentationResult> {
  let result: RetrievalResult;
  try {
    result = await retrieveContext(userQuery);
  } catch (err: unknown) {
    const msg = err instanceof ProviderError ? err.message : String(err);
    return {
      messages,
      ragUsed: false,
      chunkCount: 0,
      ragStatus: 'failed',
      ragError: msg,
    };
  }

  if (result.chunks.length === 0) {
    return {
      messages,
      ragUsed: false,
      chunkCount: 0,
      ragStatus: vectorStore.count() === 0 ? 'unavailable' : 'empty',
    };
  }

  const contextBlock = result.chunks
    .map((c, i) => `[Context ${i + 1}${typeof c.score === 'number' ? ` | score=${c.score.toFixed(3)}` : ''}]\n${c.text}`)
    .join('\n\n');

  const ragSystemMessage: ChatMessage = {
    role: 'system',
    content:
      'You have access to the following relevant context retrieved from the knowledge base.\n' +
      'Use it to inform your answer when relevant. Do not fabricate information not present in context.\n\n' +
      contextBlock,
  };

  return {
    messages: [ragSystemMessage, ...messages],
    ragUsed: true,
    chunkCount: result.chunks.length,
    ragStatus: 'used',
  };
}

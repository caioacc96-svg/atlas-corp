import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getAtlasConfig } from '../../config/atlas-config';

export interface VectorEntry {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface VectorSearchResult extends VectorEntry {
  score: number;
}

class VectorStore {
  private entries: VectorEntry[] = [];
  private filePath: string | null = null;
  private dirty = false;

  async init(): Promise<void> {
    const cfg = getAtlasConfig();
    this.filePath = path.join(cfg.dataDir, 'rag', 'vectors.json');
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(raw) as VectorEntry[];
      this.entries = Array.isArray(data) ? data : [];
      this.pruneIfNeeded();
    } catch {
      // Start fresh
    }

    // Periodic flush
    setInterval(() => this.flush().catch(() => {}), 60_000).unref();
  }

  async add(entry: Omit<VectorEntry, 'id' | 'createdAt'>): Promise<string> {
    const id = randomUUID();
    this.entries.push({ ...entry, id, createdAt: new Date().toISOString() });
    this.pruneIfNeeded();
    this.dirty = true;
    return id;
  }

  async addBatch(entries: Omit<VectorEntry, 'id' | 'createdAt'>[]): Promise<string[]> {
    const ids: string[] = [];
    for (const entry of entries) ids.push(await this.add(entry));
    return ids;
  }

  search(queryEmbedding: number[], topK: number, threshold: number): VectorSearchResult[] {
    if (this.entries.length === 0) return [];

    const scored = this.entries.map((entry) => ({
      ...entry,
      score: cosineSimilarity(queryEmbedding, entry.embedding),
    }));

    return scored
      .filter((s) => s.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async deleteByMetadata(key: string, value: unknown): Promise<number> {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.metadata[key] !== value);
    const deleted = before - this.entries.length;
    if (deleted > 0) this.dirty = true;
    return deleted;
  }

  reset(): void {
    this.entries = [];
    this.dirty = true;
  }

  count(): number {
    return this.entries.length;
  }

  stats(): { count: number; filePath: string; oldest?: string; newest?: string } {
    return {
      count: this.entries.length,
      filePath: this.filePath ?? '',
      oldest: this.entries[0]?.createdAt,
      newest: this.entries[this.entries.length - 1]?.createdAt,
    };
  }

  async flush(): Promise<void> {
    if (!this.dirty || !this.filePath) return;
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(this.entries, null, 2), 'utf-8');
      this.dirty = false;
    } catch {
      // Flush failure is non-fatal
    }
  }

  private pruneIfNeeded(): void {
    const cfg = getAtlasConfig();
    if (this.entries.length <= cfg.vectorStoreMaxEntries) return;

    const before = this.entries.length;
    const keep = Math.min(cfg.vectorStorePruneTo, cfg.vectorStoreMaxEntries);
    this.entries = this.entries
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) // newest first
      .slice(0, keep);

    this.dirty = true;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export const vectorStore = new VectorStore();

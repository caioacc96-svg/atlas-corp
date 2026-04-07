import * as fs from 'node:fs';
import * as path from 'node:path';

export interface VectorEntry {
  id: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SearchHit {
  entry: VectorEntry;
  score: number;
}

export class VectorStore {
  private vectors: VectorEntry[] = [];
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? this.defaultPath();
    this.load();
  }

  upsert(id: string, embedding: number[], metadata: Record<string, unknown> = {}): VectorEntry {
    const existing = this.vectors.findIndex((v) => v.id === id);
    const entry: VectorEntry = {
      id,
      embedding: [...embedding],
      metadata,
      createdAt: new Date().toISOString(),
    };
    if (existing >= 0) {
      this.vectors[existing] = entry;
    } else {
      this.vectors.push(entry);
    }
    this.save();
    return entry;
  }

  get(id: string): VectorEntry | undefined {
    return this.vectors.find((v) => v.id === id);
  }

  delete(id: string): boolean {
    const before = this.vectors.length;
    this.vectors = this.vectors.filter((v) => v.id !== id);
    if (this.vectors.length < before) {
      this.save();
      return true;
    }
    return false;
  }

  deleteAll(): void {
    this.vectors = [];
    this.save();
  }

  count(): number {
    return this.vectors.length;
  }

  search(query: number[], topK: number = 5): SearchHit[] {
    const scored = this.vectors.map((entry) => ({
      entry,
      score: cosineSimilarity(query, entry.embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  private defaultPath(): string {
    const base = path.join(process.env.APPDATA || process.env.HOME || '.', 'AtlasCorp', 'core');
    return path.join(base, 'vector-store.json');
  }

  private load(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.vectors = JSON.parse(raw);
        if (!Array.isArray(this.vectors)) this.vectors = [];
      }
    } catch {
      this.vectors = [];
    }
  }

  private save(): void {
    const dir = path.dirname(this.filePath);
    fs.writeFileSync(this.filePath, JSON.stringify(this.vectors, null, 2), 'utf-8');
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

import fs from 'node:fs';
import path from 'node:path';

type MemoryEntry = {
  id: string;
  scope: string;
  key: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
};

export class MemoryStore {
  private entries = new Map<string, MemoryEntry>();
  private readonly filePath: string;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'memory.json');
    fs.mkdirSync(dataDir, { recursive: true });
    this.load();
  }

  private load() {
    if (!fs.existsSync(this.filePath)) {
      return;
    }
    const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as MemoryEntry[];
    for (const entry of raw) {
      this.entries.set(entry.id, entry);
    }
  }

  private flush() {
    const entries = [...this.entries.values()];
    fs.writeFileSync(this.filePath, JSON.stringify(entries, null, 2));
  }

  upsert(scope: string, key: string, value: unknown) {
    const id = `${scope}:${key}`;
    const current = this.entries.get(id);
    const now = new Date().toISOString();
    this.entries.set(id, {
      id,
      scope,
      key,
      value,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    });
    this.flush();
  }

  get(scope: string, key: string): unknown | undefined {
    return this.entries.get(`${scope}:${key}`)?.value;
  }

  count() {
    return this.entries.size;
  }
}

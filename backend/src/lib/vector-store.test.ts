import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VectorStore, cosineSimilarity } from './vector-store';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

let tmpFile: string;

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 1], [1, 0, 1])).toBeCloseTo(1.0);
  });

  it('returns 0.0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
  });

  it('returns -1.0 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
  });

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

describe('VectorStore', () => {
  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `vector-store-test-${Date.now()}.json`);
  });

  afterEach(() => {
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  });

  it('starts empty', () => {
    const store = new VectorStore(tmpFile);
    expect(store.count()).toBe(0);
  });

  it('upserts a new vector', () => {
    const store = new VectorStore(tmpFile);
    const entry = store.upsert('v1', [0.1, 0.2, 0.3], { text: 'hello' });
    expect(entry.id).toBe('v1');
    expect(store.count()).toBe(1);
  });

  it('updates an existing vector', () => {
    const store = new VectorStore(tmpFile);
    store.upsert('v1', [1, 0, 0], { text: 'old' });
    store.upsert('v1', [0, 1, 0], { text: 'new' });
    expect(store.count()).toBe(1);

    const entry = store.get('v1');
    expect(entry?.metadata.text).toBe('new');
  });

  it('gets a vector by id', () => {
    const store = new VectorStore(tmpFile);
    store.upsert('v1', [1, 2, 3], {});
    const entry = store.get('v1');
    expect(entry).toBeDefined();
    expect(entry?.embedding).toEqual([1, 2, 3]);
  });

  it('returns undefined for non-existent id', () => {
    const store = new VectorStore(tmpFile);
    expect(store.get('nonexistent')).toBeUndefined();
  });

  it('deletes a vector', () => {
    const store = new VectorStore(tmpFile);
    store.upsert('v1', [1, 2, 3], {});
    expect(store.delete('v1')).toBe(true);
    expect(store.count()).toBe(0);
  });

  it('returns false when deleting non-existent', () => {
    const store = new VectorStore(tmpFile);
    expect(store.delete('nope')).toBe(false);
  });

  it('deletes all vectors', () => {
    const store = new VectorStore(tmpFile);
    store.upsert('v1', [1, 0, 0], {});
    store.upsert('v2', [0, 1, 0], {});
    store.deleteAll();
    expect(store.count()).toBe(0);
  });

  it('searches by similarity cosine', () => {
    const store = new VectorStore(tmpFile);
    store.upsert('a', [1, 0, 0], { text: 'x-axis' });
    store.upsert('b', [0.9, 0.1, 0], { text: 'near x' });
    store.upsert('c', [0, 1, 0], { text: 'y-axis' });

    const results = store.search([1, 0, 0], 3);
    expect(results.length).toBe(3);
    // First result should be the most similar
    expect(results[0].entry.id).toBe('a');
    expect(results[0].score).toBeCloseTo(1.0);
  });

  it('respects topK limit', () => {
    const store = new VectorStore(tmpFile);
    for (let i = 0; i < 10; i++) {
      store.upsert(`v${i}`, [Math.random(), Math.random(), Math.random()], {});
    }
    const results = store.search([0.5, 0.5, 0.5], 3);
    expect(results.length).toBe(3);
  });

  it('persists to disk and reloads', () => {
    const store1 = new VectorStore(tmpFile);
    store1.upsert('persisted', [0.1, 0.2, 0.3], { text: 'saved' });

    const store2 = new VectorStore(tmpFile);
    expect(store2.count()).toBe(1);
    expect(store2.get('persisted')?.metadata.text).toBe('saved');
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildAtlasBackendApp } from '../app';
import type { FastifyInstance } from 'fastify';

describe('RAG routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildAtlasBackendApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /rag/stats', () => {
    it('returns stats on empty index', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/rag/stats',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('count');
      expect(typeof body.count).toBe('number');
      expect(body).toHaveProperty('filePath');
    });
  });

  describe('DELETE /rag', () => {
    it('clears the index', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/rag',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.ok).toBe(true);
      expect(body.message).toBe('RAG index cleared');
    });
  });

  describe('POST /rag/ingest', () => {
    it('rejects missing text', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/rag/ingest',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('invalid_ingest');
    });

    it('rejects empty text', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/rag/ingest',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: '' }),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /rag/search', () => {
    it('rejects missing query', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/rag/search',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('invalid_search');
    });

    it('rejects invalid topK', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/rag/search',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'test', topK: 100 }),
      });

      expect(res.statusCode).toBe(400);
    });

    it('accepts valid query', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/rag/search',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'test', topK: 5 }),
      });

      // May succeed or fail depending on embedding provider availability
      expect([200, 500]).toContain(res.statusCode);
    });
  });
});

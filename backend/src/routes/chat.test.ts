import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { buildAtlasBackendApp } from '../app';
import type { FastifyInstance } from 'fastify';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('Chat routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildAtlasBackendApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /chat/conversations', () => {
    it('creates a conversation with defaults', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/chat/conversations',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(typeof body.id).toBe('string');
      expect(body.id.length).toBeGreaterThan(10);
      expect(body.title).toBe('Nova conversa');
      expect(body.messageCount).toBe(0);
      expect(body.model).toBeDefined();
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
    });

    it('creates a conversation with custom model', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/chat/conversations',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o' }),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().model).toBe('gpt-4o');
    });
  });

  describe('GET /chat/conversations', () => {
    it('returns empty list initially', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/chat/conversations',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it('returns created conversations', async () => {
      await app.inject({
        method: 'POST',
        url: '/chat/conversations',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await app.inject({
        method: 'GET',
        url: '/chat/conversations',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /chat/conversations/:id/messages', () => {
    it('returns empty list for fresh conversation', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/chat/conversations',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const { id } = createRes.json();

      const res = await app.inject({
        method: 'GET',
        url: `/chat/conversations/${id}/messages`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });

  describe('PATCH /chat/conversations/:id', () => {
    it('renames a conversation', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/chat/conversations',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const { id } = createRes.json();

      const res = await app.inject({
        method: 'PATCH',
        url: `/chat/conversations/${id}`,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'My discussion' }),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().title).toBe('My discussion');
    });

    it('rejects empty title', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/chat/conversations',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const { id } = createRes.json();

      const res = await app.inject({
        method: 'PATCH',
        url: `/chat/conversations/${id}`,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /chat/stream', () => {
    it('rejects empty content', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/chat/stream',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBe('invalid_chat_payload');
    });

    it('rejects missing content', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/chat/stream',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.statusCode).toBe(400);
    });
  });
});

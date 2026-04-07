import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { buildAtlasBackendApp } from './app';
import type { FastifyInstance } from 'fastify';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('buildAtlasBackendApp', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildAtlasBackendApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should start and register all routes', async () => {
    expect(app.printRoutes()).toBeTruthy();
  });

  it('should respond to health endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('atlas-chat-backend');
    expect(body.version).toBe('2.1.0');
    expect(body.provider).toBe('openrouter');
    expect(typeof body.model).toBe('string');
    expect(typeof body.configured).toBe('boolean');
    expect(body.streaming).toBe(true);
    expect(body.runtime).toBe('local-backend');
    expect(body.timestamp).toBeDefined();
  });

  it('should respond to health providers endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/providers',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(typeof body.anyAvailable).toBe('boolean');
    expect(typeof body.degraded).toBe('boolean');
    expect(Array.isArray(body.providers)).toBe(true);
  });

  it('should have chat routes registered', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/chat/conversations',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    // Should succeed even without OpenAI key
    expect(createRes.statusCode).toBe(200);
    expect(createRes.json().id).toBeDefined();
  });

  it('should have RAG routes registered', async () => {
    const statsRes = await app.inject({
      method: 'GET',
      url: '/rag/stats',
    });
    expect(statsRes.statusCode).toBe(200);
    expect(statsRes.json()).toHaveProperty('count');
  });

  it('should have media routes registered', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/media/generate',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'invalid_type' as string, prompt: 'test' }),
    });
    // Should fail validation for invalid type
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_request');
  });

  it('should reject media generate with missing payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/media/generate',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_request');
  });

  it('should reject media generate with valid type but missing prompt', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/media/generate',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'video' }),
    });
    expect(res.statusCode).toBe(400);
  });

  it('should reject chat stream with invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/chat/stream',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_chat_payload');
  });

  it('should reject rag ingest with invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rag/ingest',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_ingest');
  });

  it('should reject rag search with invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rag/search',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_search');
  });
});

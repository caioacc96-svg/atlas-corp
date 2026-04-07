import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { buildAtlasBackendApp } from '../app';
import type { FastifyInstance } from 'fastify';

describe('Health route', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildAtlasBackendApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with correct shape', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.status).toBe('ok');
    expect(body.service).toBe('atlas-chat-backend');
    expect(body.version).toBe('2.1.0');
    expect(body.streaming).toBe(true);
    expect(body.runtime).toBe('local-backend');
    expect(typeof body.timestamp).toBe('string');

    // Timestamp should be a valid ISO date
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});

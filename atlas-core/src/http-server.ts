import Fastify from 'fastify';
import cors from '@fastify/cors';
import { AtlasCoreRuntime } from './runtime';

export async function createHttpServer(runtime: AtlasCoreRuntime) {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  app.get('/health', async () => ({
    health: runtime.getStatus().health,
    message: runtime.getStatus().provider.detail ?? null,
  }));

  app.get('/status', async () => runtime.getStatus());

  app.get('/jobs', async () => ({
    jobs: runtime.listJobs(),
  }));

  app.post('/jobs', async (request) => {
    const body = request.body as { kind?: string; payload?: unknown } | undefined;
    const job = runtime.enqueue(body?.kind ?? 'task.run', body?.payload ?? {});
    return { ok: true, job };
  });

  app.post('/control/kill-switch/enable', async () => {
    runtime.enableKillSwitch();
    return { ok: true };
  });

  app.post('/control/kill-switch/disable', async () => {
    runtime.disableKillSwitch();
    return { ok: true };
  });

  app.post('/control/shutdown', async (_request, reply) => {
    setTimeout(() => void runtime.stop(), 50);
    reply.code(202);
    return { ok: true };
  });

  return app;
}

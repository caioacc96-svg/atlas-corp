import { createHttpServer } from './http-server';
import { AtlasCoreRuntime } from './runtime';
import { log } from './logger';

async function main() {
  const runtime = new AtlasCoreRuntime({
    version: '2.1.0-core',
    provider: (process.env.ATLAS_PROVIDER === 'ollama' ? 'ollama' : process.env.ATLAS_PROVIDER === 'openai' ? 'openai' : 'openrouter'),
    openaiApiKey: process.env.OPENAI_API_KEY || process.env.ATLAS_OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
  });

  await runtime.start();

  const host = process.env.ATLAS_CORE_HOST || '127.0.0.1';
  const port = Number(process.env.ATLAS_CORE_PORT || 4848);

  const app = await createHttpServer(runtime);
  await app.listen({ host, port });

  log('info', 'atlas-core.started', { host, port, pid: process.pid });

  const shutdown = async () => {
    await app.close();
    await runtime.stop();
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

void main().catch((error) => {
  log('error', 'atlas-core.fatal', {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

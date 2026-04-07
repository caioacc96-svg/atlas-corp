import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerHealthRoute } from './routes/health';
import { registerChatRoutes } from './routes/chat';
import { registerRagRoutes } from './routes/rag';
import { registerMediaRoutes } from './routes/media';
import { getAtlasConfig } from './config/atlas-config';
import { router } from './lib/llm/router';
import { OpenRouterProvider } from './lib/llm/providers/openrouter-provider';
import { OllamaProvider } from './lib/llm/providers/ollama-provider';
import { metricsStore } from './lib/llm/metrics-store';
import { vectorStore } from './lib/llm/vectorstore';
import { migrateFromLegacyStore } from './lib/llm/threads';

type BackendStartOptions = {
  port?: number;
  host?: string;
};

export async function buildAtlasBackendApp() {
  const cfg = getAtlasConfig();

  // Register providers based on mode
  const alwaysOllama = cfg.atlasMode === 'local_only' || cfg.atlasMode === 'hybrid_prefer_local' || cfg.atlasMode === 'hybrid_prefer_remote';
  const alwaysOpenrouter = cfg.atlasMode === 'remote_only' || cfg.atlasMode === 'hybrid_prefer_local' || cfg.atlasMode === 'hybrid_prefer_remote';

  if (alwaysOllama) {
    router.register(new OllamaProvider());
  }
  if (alwaysOpenrouter) {
    router.register(new OpenRouterProvider());
  }

  // Init persistence
  await metricsStore.init().catch(() => {});
  await vectorStore.init().catch(() => {});

  // Migrate from legacy store
  await migrateFromLegacyStore().catch(() => {});

  const app = Fastify({ logger: { level: 'info' } });
  await app.register(cors, { origin: true });
  await registerHealthRoute(app);
  await registerChatRoutes(app);
  await registerRagRoutes(app);
  await registerMediaRoutes(app);
  return app;
}

export async function startAtlasBackendServer(options: BackendStartOptions = {}) {
  const app = await buildAtlasBackendApp();
  const port = options.port ?? Number(process.env.ATLAS_BACKEND_PORT ?? 4467);
  const host = options.host ?? process.env.ATLAS_BACKEND_HOST ?? '127.0.0.1';
  await app.listen({ port, host });
  app.log.info(`Atlas chat backend online em http://${host}:${port}`);
  return async () => {
    await app.close();
  };
}

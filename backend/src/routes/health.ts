import { FastifyInstance } from 'fastify';
import { getAtlasConfig } from '../config/atlas-config';
import { router } from '../lib/llm/router';
import { metricsStore } from '../lib/llm/metrics-store';
import { vectorStore } from '../lib/llm/vectorstore';

export async function registerHealthRoute(app: FastifyInstance) {
  const config = getAtlasConfig();

  app.get('/health', async () => {
    const model = config.openrouterApiKey ? config.remoteModel : config.localModel;

    return {
      status: 'ok' as const,
      service: 'atlas-chat-backend' as const,
      version: '2.1.0',
      provider: config.openrouterApiKey ? 'openrouter' : 'ollama',
      model,
      configured: Boolean(config.openrouterApiKey),
      streaming: true,
      runtime: 'local-backend' as const,
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/health/providers', async () => {
    const providers = router.getAll();
    const scores = router.scores();

    const probeResults = await Promise.allSettled(
      providers.map(async (p) => ({
        id: p.id,
        displayName: p.displayName,
        reachable: await p.probe(),
        score: scores[p.id] ?? 0,
        metrics: metricsStore.snapshot(p.id),
        capabilities: {
          chat: p.supportsChat,
          embed: p.supportsEmbed,
          stream: p.supportsStreaming,
        },
      })),
    );

    const mapped = probeResults.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { id: 'unknown', reachable: false, error: String(r.reason) },
    );

    const anyReachable = mapped.some((r) => r.reachable);
    const unreachable = mapped.filter((r) => !r.reachable).length;

    return {
      anyAvailable: anyReachable,
      degraded: providers.length > 0 && unreachable > 0 && unreachable < providers.length,
      mode: config.atlasMode,
      vectorStore: vectorStore.stats(),
      providers: mapped,
      ts: new Date().toISOString(),
    };
  });
}

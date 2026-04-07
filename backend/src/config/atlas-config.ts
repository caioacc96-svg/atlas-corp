import { z } from 'zod';
import path from 'node:path';
import os from 'node:os';

// --- Schemas ---

// Support 'auto' as alias for 'hybrid_prefer_local' (Forge legacy compat)
export type AtlasModeType = 'local_only' | 'remote_only' | 'hybrid_prefer_local' | 'hybrid_prefer_remote';

const PROVIDER_MODES = ['local_only', 'remote_only', 'hybrid_prefer_local', 'hybrid_prefer_remote', 'auto'] as const;
const routerStrategySchema = z.enum(['latency_first', 'capability_first']);

// --- Config type ---

export type AtlasConfig = {
  atlasMode: AtlasModeType;
  providerDefault: 'openrouter' | 'ollama';
  routerStrategy: z.TypeOf<typeof routerStrategySchema>;
  remoteModel: string;
  localModel: string;
  embedProvider: 'ollama' | 'openrouter';
  embedModel: string;
  ollamaBaseUrl: string;
  openaiBaseUrl: string;
  openaiApiKey: string;
  // OpenRouter (patch naming)
  openrouterApiKey: string;
  openrouterSiteUrl: string;
  openrouterSiteName: string;
  openrouterDefaultModel: string;
  // Ollama
  ollamaTimeoutMs: number;
  // RAG
  ragEnabled: boolean;
  ragTopK: number;
  ragScoreThreshold: number;
  ragChunkSize: number;
  ragChunkOverlap: number;
  // Timeouts
  streamTimeoutMs: number;
  nonStreamTimeoutMs: number;
  streamStallMs: number;
  stallFallbackEnabled: boolean;
  // Data persistence
  dataDir: string;
  // Logging
  logLevel: string;
  // Router scoring weights
  routerLatencyWeight: number;
  routerSuccessWeight: number;
  routerRecencyWeight: number;
  routerFailureCooldownMs: number;
  // Vector store controls
  vectorStoreMaxEntries: number;
  vectorStorePruneTo: number;
};

const DEFAULTS: AtlasConfig = {
  atlasMode: 'hybrid_prefer_local',
  providerDefault: 'openrouter',
  routerStrategy: 'latency_first',
  remoteModel: 'openai/gpt-4o-mini',
  localModel: 'qwen3:latest',
  embedProvider: 'ollama',
  embedModel: 'nomic-embed-text',
  ollamaBaseUrl: 'http://localhost:11434',
  openaiBaseUrl: 'https://openrouter.ai/api/v1',
  openaiApiKey: '',
  openrouterApiKey: '',
  openrouterSiteUrl: 'https://atlascorp.local',
  openrouterSiteName: 'Atlas Corp Desktop',
  openrouterDefaultModel: 'qwen/qwen3.6-plus:free',
  ollamaTimeoutMs: 30_000,
  ragEnabled: true,
  ragTopK: 3,
  ragScoreThreshold: 0.65,
  ragChunkSize: 512,
  ragChunkOverlap: 64,
  streamTimeoutMs: 25_000,
  nonStreamTimeoutMs: 45_000,
  streamStallMs: 12_000,
  stallFallbackEnabled: true,
  dataDir: path.join(os.homedir(), '.atlas-corp', 'data'),
  logLevel: 'info',
  routerLatencyWeight: 0.4,
  routerSuccessWeight: 0.4,
  routerRecencyWeight: 0.2,
  routerFailureCooldownMs: 60_000,
  vectorStoreMaxEntries: 20_000,
  vectorStorePruneTo: 18_000,
};

let resolved: AtlasConfig | null = null;

function env(): Record<string, string | undefined> {
  return process.env;
}

export function getAtlasConfig(): AtlasConfig {
  if (resolved) return resolved;

  const e = env();

  // Normalize 'auto' to 'hybrid_prefer_local' (Forge compat)
  let atlasModeRaw = e.ATLAS_MODE || '';
  if (atlasModeRaw === 'auto' || atlasModeRaw === '') atlasModeRaw = 'hybrid_prefer_local';
  const atlasMode = atlasModeRaw as AtlasModeType;

  // Support OPENROUTER_API_KEY or OPENAI_API_KEY (backward compat)
  const apiKey = e.OPENROUTER_API_KEY || e.OPENAI_API_KEY || '';

  resolved = {
    atlasMode,
    providerDefault: e.ATLAS_PROVIDER_DEFAULT === 'ollama' ? 'ollama' : 'openrouter',
    routerStrategy: parseEnum(e.ATLAS_ROUTER_STRATEGY, routerStrategySchema, DEFAULTS.routerStrategy),
    remoteModel: e.ATLAS_REMOTE_MODEL || e.ATLAS_MODEL || DEFAULTS.remoteModel,
    localModel: e.ATLAS_LOCAL_MODEL || DEFAULTS.localModel,
    embedProvider: e.ATLAS_EMBED_PROVIDER === 'openrouter' ? 'openrouter' : 'ollama',
    embedModel: e.ATLAS_EMBED_MODEL || DEFAULTS.embedModel,
    ollamaBaseUrl: e.OLLAMA_BASE_URL || DEFAULTS.ollamaBaseUrl,
    openaiBaseUrl: e.OPENAI_BASE_URL || DEFAULTS.openaiBaseUrl,
    openaiApiKey: apiKey,
    openrouterApiKey: apiKey,
    openrouterSiteUrl: e.OPENROUTER_SITE_URL || DEFAULTS.openrouterSiteUrl,
    openrouterSiteName: e.OPENROUTER_SITE_NAME || DEFAULTS.openrouterSiteName,
    openrouterDefaultModel: e.ATLAS_DEFAULT_MODEL || DEFAULTS.openrouterDefaultModel,
    ollamaTimeoutMs: parseNumber(e.OLLAMA_TIMEOUT_MS, DEFAULTS.ollamaTimeoutMs),
    ragEnabled: e.ATLAS_RAG_ENABLED === 'false' ? false : DEFAULTS.ragEnabled,
    ragTopK: parseNumber(e.ATLAS_RAG_TOP_K || e.RAG_TOP_K, DEFAULTS.ragTopK),
    ragScoreThreshold: parseNumber(e.ATLAS_RAG_SCORE_THRESHOLD || e.RAG_SIMILARITY_THRESHOLD, DEFAULTS.ragScoreThreshold),
    ragChunkSize: parseNumber(e.RAG_CHUNK_SIZE, DEFAULTS.ragChunkSize),
    ragChunkOverlap: parseNumber(e.RAG_CHUNK_OVERLAP, DEFAULTS.ragChunkOverlap),
    streamTimeoutMs: parseNumber(e.ATLAS_STREAM_TIMEOUT_MS, DEFAULTS.streamTimeoutMs),
    nonStreamTimeoutMs: parseNumber(e.ATLAS_NON_STREAM_TIMEOUT_MS, DEFAULTS.nonStreamTimeoutMs),
    streamStallMs: parseNumber(e.ATLAS_STREAM_STALL_MS, DEFAULTS.streamStallMs),
    stallFallbackEnabled: e.ATLAS_STALL_FALLBACK_ENABLED === 'false' ? false : DEFAULTS.stallFallbackEnabled,
    dataDir: e.DATA_DIR || e.ATLAS_DATA_DIR || DEFAULTS.dataDir,
    logLevel: e.LOG_LEVEL || DEFAULTS.logLevel,
    routerLatencyWeight: parseNumber(e.ROUTER_LATENCY_WEIGHT, DEFAULTS.routerLatencyWeight),
    routerSuccessWeight: parseNumber(e.ROUTER_SUCCESS_WEIGHT, DEFAULTS.routerSuccessWeight),
    routerRecencyWeight: parseNumber(e.ROUTER_RECENCY_WEIGHT, DEFAULTS.routerRecencyWeight),
    routerFailureCooldownMs: parseNumber(e.ROUTER_FAILURE_COOLDOWN_MS, DEFAULTS.routerFailureCooldownMs),
    vectorStoreMaxEntries: parseNumber(e.VECTORSTORE_MAX_ENTRIES, DEFAULTS.vectorStoreMaxEntries),
    vectorStorePruneTo: parseNumber(e.VECTORSTORE_PRUNE_TO, DEFAULTS.vectorStorePruneTo),
  };

  return resolved;
}

/** Validate that current mode has required keys. */
export function validateConfigForMode(): string[] {
  const cfg = getAtlasConfig();
  const issues: string[] = [];
  if (cfg.atlasMode === 'remote_only' && !cfg.openrouterApiKey) {
    issues.push('OPENROUTER_API_KEY is required when ATLAS_MODE=remote_only');
  }
  return issues;
}

/** Resolve the canonical model for the current config mode. */
export function resolveModelFor(mode?: 'remote' | 'local'): string {
  const cfg = getAtlasConfig();
  if (mode === 'remote') return cfg.remoteModel;
  if (mode === 'local') return cfg.localModel;
  return cfg.openrouterApiKey ? cfg.remoteModel : cfg.localModel;
}

export function resolveEmbedConfig(): { url: string; apiKey: string; model: string; provider: string } {
  const cfg = getAtlasConfig();
  if (cfg.embedProvider === 'ollama') {
    return {
      url: `${cfg.ollamaBaseUrl}/api/embed`,
      apiKey: '',
      model: cfg.embedModel,
      provider: 'ollama',
    };
  }
  return {
    url: `${cfg.openaiBaseUrl}/embeddings`,
    apiKey: cfg.openaiApiKey,
    model: cfg.embedModel,
    provider: 'openrouter',
  };
}

export function resetConfig() {
  resolved = null;
}

// --- Parsers ---

function parseEnum<T extends z.ZodTypeAny>(value: string | undefined, schema: T, fallback: z.TypeOf<T>): z.TypeOf<T> {
  if (!value) return fallback;
  const result = schema.safeParse(value);
  return result.success ? result.data : fallback;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

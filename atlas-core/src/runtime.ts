import os from 'node:os';
import path from 'node:path';
import { PersistentJobQueue } from './persistent-job-queue';
import { Scheduler } from './scheduler';
import { MemoryStore } from './memory-store';
import { AuditLog } from './audit-log';
import { KillSwitch, ApprovalGate, Allowlist } from './security';
import { OpenAIProvider, OllamaProvider } from './providers';
import { CoreStatus, JobKind, ProviderAdapter } from './contracts';
import { Watchdog } from './watchdog';
import { log } from './logger';
import { RagIndex, RagIndexConfig } from './rag-index';
import { RagContext } from './rag-context';

export class AtlasCoreRuntime {
  private readonly startedAt = new Date();
  private readonly queue: PersistentJobQueue;
  private readonly scheduler: Scheduler;
  private readonly memory: MemoryStore;
  private readonly audit = new AuditLog();
  private readonly killSwitch = new KillSwitch();
  private readonly approvalGate = new ApprovalGate();
  private readonly allowlist = new Allowlist();
  private readonly watchdog = new Watchdog();
  private readonly provider: ProviderAdapter;
  private readonly ragIndex: RagIndex;
  private workerTimer: NodeJS.Timeout | null = null;
  private health: CoreStatus['health'] = 'starting';

  constructor(private readonly config: {
    version: string;
    dataDir?: string;
    provider: 'openrouter' | 'openai' | 'ollama';
    openaiApiKey?: string;
    openaiBaseUrl?: string;
    ollamaBaseUrl?: string;
  }) {
    const dataDir = config.dataDir ?? path.join(os.homedir(), 'AppData', 'Roaming', 'AtlasCorp', 'core');
    this.queue = new PersistentJobQueue(dataDir);
    this.scheduler = new Scheduler(this.queue);
    this.memory = new MemoryStore(dataDir);
    this.provider = config.provider === 'ollama'
      ? new OllamaProvider({ baseUrl: config.ollamaBaseUrl })
      : config.provider === 'openrouter'
        ? new OpenAIProvider({ apiKey: config.openaiApiKey ?? '', baseUrl: config.openaiBaseUrl ?? 'https://openrouter.ai/api/v1' })
        : new OpenAIProvider({ apiKey: config.openaiApiKey ?? '', baseUrl: config.openaiBaseUrl });

    const ragConfig: RagIndexConfig = {
      embeddingApiUrl: config.provider === 'ollama'
        ? config.ollamaBaseUrl
          ? `${config.ollamaBaseUrl}/v1/embeddings`
          : 'http://127.0.0.1:11434/v1/embeddings'
        : `${config.openaiBaseUrl ?? 'https://openrouter.ai/api/v1'}/embeddings`,
      embeddingApiKey: config.openaiApiKey,
    };
    this.ragIndex = new RagIndex(ragConfig);
  }

  async start() {
    this.audit.add({ type: 'core.started', actor: 'system', entityType: 'core' });
    this.scheduler.start();
    this.watchdog.start(async () => {
      this.audit.add({ type: 'watchdog.recover', actor: 'system', entityType: 'worker' });
      await this.restartWorker();
    });
    await this.restartWorker();

    const provider = await this.provider.healthcheck();
    this.health = provider.ok ? 'healthy' : 'degraded';
  }

  async restartWorker() {
    if (this.workerTimer) clearInterval(this.workerTimer);

    this.workerTimer = setInterval(() => {
      void this.workOnce();
    }, 1_500);
  }

  private async workOnce() {
    this.watchdog.beat();
    this.queue.recoverExpiredLeases();

    const job = this.queue.leaseNext();
    if (!job) return;

    if (this.killSwitch.isEnabled()) {
      this.queue.markFailed(job.id, 'Kill switch enabled', false);
      this.audit.add({ type: 'job.blocked.kill_switch', actor: 'system', entityType: 'job', entityId: job.id });
      return;
    }

    if (!this.allowlist.isActionAllowed(job.kind)) {
      this.queue.markFailed(job.id, `Action not allowed: ${job.kind}`, false);
      return;
    }

    this.queue.markRunning(job.id);

    try {
      await this.execute(job.kind, job.payload);
      this.queue.markCompleted(job.id);
      this.audit.add({ type: 'job.completed', actor: 'system', entityType: 'job', entityId: job.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.queue.markFailed(job.id, message, true);
      this.audit.add({ type: 'job.failed', actor: 'system', entityType: 'job', entityId: job.id, payload: { message } });
      log('error', 'job.failed', { jobId: job.id, kind: job.kind, message });
    }
  }

  private async execute(kind: JobKind, payload: unknown) {
    switch (kind) {
      case 'boot.init':
        this.memory.upsert('system', 'lastBoot', { at: new Date().toISOString(), payload });
        return;
      case 'heartbeat':
        this.memory.upsert('system', 'heartbeat', payload);
        return;
      case 'memory.compact':
        return;
      case 'chat.run': {
        const input = payload as {
          model?: string;
          system?: string;
          messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
        };
        const model = input.model ?? (
          this.provider.name === 'openrouter' ? 'qwen/qwen3.6-plus:free' :
          this.provider.name === 'ollama' ? 'llama3.1' : 'gpt-4o'
        );
        const result = await this.provider.generate({
          model,
          system: input.system,
          messages: input.messages ?? [{ role: 'user', content: 'Olá' }],
        });
        this.memory.upsert('chat', `last:${Date.now()}`, result);
        return;
      }
      case 'task.run': {
        const input = payload as {
          name?: string;
          model?: string;
          system?: string;
          prompt?: string;
        };
        const model = input.model ?? (
          this.provider.name === 'openrouter' ? 'qwen/qwen3.6-plus:free' :
          this.provider.name === 'ollama' ? 'llama3.1' : 'gpt-4o'
        );
        const result = await this.provider.generate({
          model,
          system: input.system,
          messages: [{ role: 'user', content: input.prompt ?? 'execute' }],
        });
        this.memory.upsert('task', `run:${input.name ?? Date.now()}`, { input, output: result.text, at: new Date().toISOString() });
        return;
      }
      case 'rag.ingest': {
        const input = payload as { text: string; source?: string };
        if (!input.text) throw new Error('rag.ingest requires "text" in payload');
        const result = await this.ragIndex.ingest(input.text, { source: input.source });
        this.memory.upsert('rag', `ingest:${Date.now()}`, { ...result, at: new Date().toISOString() });
        return result;
      }
      case 'rag.search': {
        const input = payload as { query: string; topK?: number };
        if (!input.query) throw new Error('rag.search requires "query" in payload');
        const results = await this.ragIndex.search(input.query, input.topK ?? 5);
        this.memory.upsert('rag', `search:${Date.now()}`, { query: input.query, hitCount: results.length, at: new Date().toISOString() });
        return { results };
      }
      case 'rag.reset': {
        this.ragIndex.reset();
        this.memory.upsert('rag', 'reset', { at: new Date().toISOString() });
        return { ok: true };
      }
      default:
        throw new Error(`Unsupported job kind: ${kind satisfies never}`);
    }
  }

  enqueue(kind: string, payload: unknown) {
    return this.queue.enqueue(kind as JobKind, payload, new Date());
  }

  listJobs() {
    return this.queue.list();
  }

  enableKillSwitch() {
    this.killSwitch.enable();
    this.audit.add({ type: 'kill_switch.enabled', actor: 'operator', entityType: 'safety' });
  }

  disableKillSwitch() {
    this.killSwitch.disable();
    this.audit.add({ type: 'kill_switch.disabled', actor: 'operator', entityType: 'safety' });
  }

  getStatus(): CoreStatus {
    const providerState = {
      active: this.provider.name,
      ok: this.health !== 'unhealthy',
      detail: this.health === 'degraded' ? 'provider healthcheck degraded' : 'ok',
    };

    return {
      pid: process.pid,
      version: this.config.version,
      health: this.health,
      startedAt: this.startedAt.toISOString(),
      uptimeMs: Date.now() - this.startedAt.getTime(),
      queue: this.queue.stats(),
      scheduler: this.scheduler.getState(),
      memory: { entries: this.memory.count() },
      safety: {
        killSwitch: this.killSwitch.isEnabled(),
        approvalRequired: this.approvalGate.isRequired(),
      },
      provider: providerState,
    };
  }

  async stop() {
    if (this.workerTimer) clearInterval(this.workerTimer);
    this.scheduler.stop();
    this.watchdog.stop();
    this.audit.add({ type: 'core.stopped', actor: 'system', entityType: 'core' });
    process.exit(0);
  }
}

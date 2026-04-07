import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ChatTaskType } from './types';
import { getAtlasConfig } from '../../config/atlas-config';

export interface ProviderMetrics {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  streamSuccessCount: number;
  streamFailureCount: number;
  taskCounts: Partial<Record<ChatTaskType, number>>;
  lastFailureAt: number | null;
  recentLatencies: number[];
}

function emptyMetrics(): ProviderMetrics {
  return {
    totalRequests: 0, successCount: 0, failureCount: 0,
    streamSuccessCount: 0, streamFailureCount: 0,
    taskCounts: {}, lastFailureAt: null, recentLatencies: [],
  };
}

class MetricsStore {
  private store: Map<string, ProviderMetrics> = new Map();
  private dirty = false;
  private filePath: string | null = null;

  async init(): Promise<void> {
    const cfg = getAtlasConfig();
    const dir = path.join(cfg.dataDir, 'llm');
    this.filePath = path.join(dir, 'metrics.json');
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, Partial<ProviderMetrics>>;
      for (const [k, v] of Object.entries(parsed)) {
        this.store.set(k, { ...emptyMetrics(), ...v, taskCounts: v.taskCounts ?? {} });
      }
    } catch {
      // Start fresh
    }

    // Periodic flush
    setInterval(() => this.flush().catch(() => {}), 30_000).unref();
  }

  recordSuccess(providerId: string, latencyMs: number, taskType?: ChatTaskType, streamed = false): void {
    const m = this.get(providerId);
    m.totalRequests++;
    m.successCount++;
    if (streamed) m.streamSuccessCount++;
    if (taskType) m.taskCounts[taskType] = (m.taskCounts[taskType] ?? 0) + 1;
    m.recentLatencies.push(latencyMs);
    if (m.recentLatencies.length > 20) m.recentLatencies.shift();
    this.dirty = true;
  }

  recordFailure(providerId: string, streamed = false): void {
    const m = this.get(providerId);
    m.totalRequests++;
    m.failureCount++;
    if (streamed) m.streamFailureCount++;
    m.lastFailureAt = Date.now();
    this.dirty = true;
  }

  snapshot(providerId: string): ProviderMetrics {
    return { ...this.get(providerId), taskCounts: { ...this.get(providerId).taskCounts } };
  }

  private get(id: string): ProviderMetrics {
    if (!this.store.has(id)) this.store.set(id, emptyMetrics());
    return this.store.get(id)!;
  }

  async flush(): Promise<void> {
    if (!this.dirty || !this.filePath) return;
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const obj: Record<string, ProviderMetrics> = {};
      for (const [k, v] of this.store) obj[k] = v;
      await fs.writeFile(this.filePath, JSON.stringify(obj, null, 2), 'utf-8');
      this.dirty = false;
    } catch {
      // Flush failure is non-fatal
    }
  }
}

export const metricsStore = new MetricsStore();

/** Patch-style scoring: weighted success rate, latency, and failure recency. */
export function computeScore(providerId: string, opts?: { taskType?: ChatTaskType; preferStreaming?: boolean }): number {
  const cfg = getAtlasConfig();
  const m = metricsStore.snapshot(providerId);

  const successRate = m.totalRequests === 0 ? 1.0 : m.successCount / m.totalRequests;
  const avgLatency = m.recentLatencies.length === 0
    ? 0
    : m.recentLatencies.reduce((a, b) => a + b, 0) / m.recentLatencies.length;
  const normalizedLatency = Math.min(avgLatency / 30_000, 1);

  const cooldown = cfg.routerFailureCooldownMs;
  const recentFailure = m.lastFailureAt !== null && Date.now() - m.lastFailureAt < cooldown ? 1 : 0;

  let score =
    cfg.routerSuccessWeight * (successRate === 0 ? 0.5 : successRate) +
    cfg.routerLatencyWeight * (1 - normalizedLatency) +
    cfg.routerRecencyWeight * (1 - recentFailure);

  if (opts?.taskType) {
    const taskCount = m.taskCounts[opts.taskType] ?? 0;
    score += Math.min(taskCount / 20, 0.05);
    if (opts.taskType === 'code_generation' && providerId === 'openrouter') score += 0.06;
    if (opts.taskType === 'chat_with_rag' && providerId === 'ollama') score += 0.05;
    if (opts.taskType === 'long_generation' && providerId === 'openrouter') score += 0.04;
  }

  if (opts?.preferStreaming) {
    const totalStreamAttempts = m.streamSuccessCount + m.streamFailureCount;
    const streamRate = totalStreamAttempts === 0 ? 1 : m.streamSuccessCount / totalStreamAttempts;
    score += 0.08 * streamRate;
  }

  return score;
}

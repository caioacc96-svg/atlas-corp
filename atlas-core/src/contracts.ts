export type HealthState = 'starting' | 'healthy' | 'degraded' | 'unhealthy' | 'stopped';

export type ProviderKind = 'openrouter' | 'openai' | 'ollama';

export type JobStatus =
  | 'queued'
  | 'leased'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked';

export type JobKind =
  | 'boot.init'
  | 'heartbeat'
  | 'chat.run'
  | 'task.run'
  | 'memory.compact'
  | 'rag.ingest'
  | 'rag.search'
  | 'rag.reset';

export interface JobRecord<TPayload = unknown> {
  id: string;
  kind: JobKind;
  status: JobStatus;
  payload: TPayload;
  priority: number;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  leasedUntil?: string;
  correlationId?: string;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CoreStatus {
  pid: number;
  version: string;
  health: HealthState;
  startedAt: string;
  uptimeMs: number;
  queue: {
    pending: number;
    running: number;
    failed: number;
    completed: number;
  };
  scheduler: {
    running: boolean;
    lastHeartbeatAt?: string;
  };
  memory: {
    entries: number;
  };
  safety: {
    killSwitch: boolean;
    approvalRequired: boolean;
  };
  provider: {
    active: ProviderKind;
    ok: boolean;
    detail?: string;
  };
}

export interface ProviderGenerateInput {
  model: string;
  system?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

export interface ProviderGenerateOutput {
  text: string;
  raw?: unknown;
}

export interface ProviderAdapter {
  readonly name: ProviderKind;
  healthcheck(): Promise<{ ok: boolean; detail?: string }>;
  generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput>;
}

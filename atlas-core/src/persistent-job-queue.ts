import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { JobKind, JobRecord } from './contracts';

type QueueFile = {
  jobs: JobRecord[];
};

export class PersistentJobQueue {
  private readonly filePath: string;
  private queue: QueueFile = { jobs: [] };

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'jobs.json');
    fs.mkdirSync(dataDir, { recursive: true });
    this.load();
  }

  private load() {
    if (!fs.existsSync(this.filePath)) {
      this.flush();
      return;
    }

    this.queue = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as QueueFile;
  }

  private flush() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.queue, null, 2));
  }

  enqueue(kind: JobKind, payload: unknown, runAt = new Date(), priority = 100): JobRecord {
    const now = new Date().toISOString();
    const job: JobRecord = {
      id: randomUUID(),
      kind,
      status: 'queued',
      payload,
      priority,
      attempts: 0,
      maxAttempts: 3,
      runAt: runAt.toISOString(),
      createdAt: now,
      updatedAt: now,
    };

    this.queue.jobs.push(job);
    this.queue.jobs.sort((a, b) => a.priority - b.priority || a.runAt.localeCompare(b.runAt));
    this.flush();
    return job;
  }

  leaseNext(now = new Date()): JobRecord | null {
    const candidate = this.queue.jobs.find(
      (job) => job.status === 'queued' && new Date(job.runAt).getTime() <= now.getTime()
    );

    if (!candidate) return null;

    candidate.status = 'leased';
    candidate.leasedUntil = new Date(now.getTime() + 30_000).toISOString();
    candidate.updatedAt = new Date().toISOString();
    this.flush();
    return candidate;
  }

  markRunning(id: string) {
    const job = this.queue.jobs.find((item) => item.id === id);
    if (!job) return;
    job.status = 'running';
    job.updatedAt = new Date().toISOString();
    this.flush();
  }

  markCompleted(id: string) {
    const job = this.queue.jobs.find((item) => item.id === id);
    if (!job) return;
    job.status = 'completed';
    job.updatedAt = new Date().toISOString();
    this.flush();
  }

  markFailed(id: string, message: string, retryable = true) {
    const job = this.queue.jobs.find((item) => item.id === id);
    if (!job) return;
    job.attempts += 1;
    job.error = { code: 'job_failed', message, retryable };
    job.updatedAt = new Date().toISOString();

    if (retryable && job.attempts < job.maxAttempts) {
      job.status = 'queued';
      job.runAt = new Date(Date.now() + 15_000).toISOString();
      job.leasedUntil = undefined;
    } else {
      job.status = 'failed';
    }

    this.flush();
  }

  recoverExpiredLeases(now = new Date()) {
    for (const job of this.queue.jobs) {
      if (job.status !== 'leased') continue;
      if (!job.leasedUntil) continue;
      if (new Date(job.leasedUntil).getTime() > now.getTime()) continue;
      job.status = 'queued';
      job.leasedUntil = undefined;
      job.updatedAt = new Date().toISOString();
    }
    this.flush();
  }

  stats() {
    return {
      pending: this.queue.jobs.filter((j) => j.status === 'queued' || j.status === 'leased').length,
      running: this.queue.jobs.filter((j) => j.status === 'running').length,
      failed: this.queue.jobs.filter((j) => j.status === 'failed').length,
      completed: this.queue.jobs.filter((j) => j.status === 'completed').length,
    };
  }

  list() {
    return [...this.queue.jobs];
  }
}

import { PersistentJobQueue } from './persistent-job-queue';

export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private running = false;
  private lastHeartbeatAt: string | undefined;

  constructor(private readonly queue: PersistentJobQueue) {}

  start() {
    if (this.running) return;
    this.running = true;

    this.queue.enqueue('boot.init', { source: 'scheduler.start' }, new Date(), 1);

    this.heartbeatTimer = setInterval(() => {
      this.lastHeartbeatAt = new Date().toISOString();
      this.queue.enqueue('heartbeat', { at: this.lastHeartbeatAt }, new Date(), 10);
    }, 30_000);

    this.timer = setInterval(() => {
      this.queue.recoverExpiredLeases();
    }, 10_000);
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  getState() {
    return {
      running: this.running,
      lastHeartbeatAt: this.lastHeartbeatAt,
    };
  }
}

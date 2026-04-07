import { log } from './logger';

export class Watchdog {
  private timer: NodeJS.Timeout | null = null;
  private lastWorkerBeat = Date.now();

  start(onTimeout: () => Promise<void>) {
    this.timer = setInterval(() => {
      const delta = Date.now() - this.lastWorkerBeat;
      if (delta > 60_000) {
        log('warn', 'watchdog.worker_timeout', { deltaMs: delta });
        void onTimeout();
      }
    }, 15_000);
  }

  beat() {
    this.lastWorkerBeat = Date.now();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

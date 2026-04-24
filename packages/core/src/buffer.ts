import type { SpanPayload } from './types.js';

const MAX_BUFFER_SIZE = 100;
const DEFAULT_FLUSH_INTERVAL_MS = 5_000;

export class SpanBuffer {
  private readonly pending: SpanPayload[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly flushIntervalMs: number;
  private stopped = false;

  constructor(
    private readonly sender: (spans: SpanPayload[]) => Promise<void>,
    flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
  ) {
    this.flushIntervalMs = flushIntervalMs;
  }

  /** Ensure the interval timer is running. Called whenever spans are added. */
  private ensureTimer(): void {
    if (this.stopped || this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.drain().then(() => {
        // reschedule only if there are still spans pending
        if (this.pending.length > 0) this.ensureTimer();
      });
    }, this.flushIntervalMs);
    // unref so the timer does not keep the Node.js process alive
    const t = this.timer as { unref?: () => void } | null;
    if (t && typeof t.unref === 'function') {
      t.unref();
    }
  }

  add(span: SpanPayload): void {
    this.pending.push(span);
    if (this.pending.length >= MAX_BUFFER_SIZE) {
      void this.drain();
    } else {
      this.ensureTimer();
    }
  }

  async drain(): Promise<void> {
    if (this.pending.length === 0) return;
    const batch = this.pending.splice(0, MAX_BUFFER_SIZE);
    await this.sender(batch);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

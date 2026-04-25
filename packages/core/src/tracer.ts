import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import type { SpanKind, SpanPayload, TraceSpanOptions } from './types.js';

interface SpanContext {
  spanId: string;
  traceId: string;
}

const storage = new AsyncLocalStorage<SpanContext>();

export function getActiveContext(): { spanId: string; traceId: string } | undefined {
  return storage.getStore();
}

export function runWithContext<T>(
  ctx: { spanId: string; traceId: string },
  fn: () => T,
): T {
  return storage.run(ctx, fn);
}

export class Span {
  readonly id = randomUUID();
  private status: 'ok' | 'error' = 'ok';
  private readonly attrs: Record<string, unknown> = {};
  private readonly startTime = Date.now();
  private ended = false;

  constructor(
    readonly name: string,
    readonly kind: SpanKind,
    readonly traceId: string,
    readonly parentSpanId: string | null,
    private readonly onEnd: (payload: SpanPayload) => void,
  ) {}

  setAttribute(key: string, value: unknown): void {
    this.attrs[key] = value;
  }

  recordError(error: Error): void {
    this.status = 'error';
    this.attrs['error.message'] = error.message;
    this.attrs['error.stack'] = error.stack ?? '';
  }

  end(attributes?: Record<string, unknown>): void {
    if (this.ended) return;
    this.ended = true;
    if (attributes) Object.assign(this.attrs, attributes);
    const endTime = Date.now();
    this.onEnd({
      id: this.id,
      traceId: this.traceId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      kind: this.kind,
      startTime: this.startTime,
      endTime,
      durationMs: endTime - this.startTime,
      status: this.status,
      attributes: { ...this.attrs },
    });
  }
}

const NOOP_SPAN = {
  setAttribute: (_key: string, _value: unknown) => {},
  recordError: (_error: Error) => {},
  end: (_attributes?: Record<string, unknown>) => {},
} as unknown as Span;

export class Trace {
  readonly id: string;
  // name is stored for future per-trace ingestion (v1 batched API does not transmit it)
  readonly name: string;

  constructor(
    private readonly onSpan: ((payload: SpanPayload) => void) | null,
    readonly tenantId?: string,
    name = '',
  ) {
    this.id = onSpan ? randomUUID() : '';
    this.name = name;
  }

  startSpan(name: string, kind: SpanKind = 'custom'): Span {
    if (!this.onSpan) return NOOP_SPAN;
    const context = storage.getStore();
    const parentSpanId = context?.spanId ?? null;
    const { tenantId } = this;
    return new Span(name, kind, this.id, parentSpanId, (payload) =>
      this.onSpan!({ ...payload, tenantId }),
    );
  }

  async trace<T>(
    name: string,
    fn: () => Promise<T>,
    options: TraceSpanOptions = {},
  ): Promise<T> {
    if (!this.onSpan) return fn();

    const span = this.startSpan(name, options.kind ?? 'custom');
    if (options.attributes) {
      for (const [k, v] of Object.entries(options.attributes)) {
        span.setAttribute(k, v);
      }
    }

    try {
      const result = await storage.run({ spanId: span.id, traceId: this.id }, fn);
      span.end();
      return result;
    } catch (error) {
      if (error instanceof Error) span.recordError(error);
      span.end();
      throw error;
    }
  }
}

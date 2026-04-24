import type {
  AgentLensClientOptions,
  SpanPayload,
  StartTraceOptions,
  TracePayload,
} from './types.js';
import { SpanBuffer } from './buffer.js';
import { Trace } from './tracer.js';

const DEFAULT_ENDPOINT = 'https://ingest.agentlens.io';
const MAX_RETRIES = 3;
const FLUSH_TIMEOUT_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AgentLensClient {
  private readonly apiKey: string;
  private readonly projectId: string;
  private readonly endpoint: string;
  private readonly disabled: boolean;
  private readonly buffer: SpanBuffer | null;

  constructor(options: AgentLensClientOptions) {
    this.apiKey = options.apiKey;
    this.projectId = options.projectId;
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.disabled = options.disabled ?? false;
    this.buffer = this.disabled
      ? null
      : new SpanBuffer((spans) => this.send(spans));
  }

  startTrace(options: StartTraceOptions): Trace {
    if (this.disabled) return new Trace(null, options.tenantId);
    return new Trace((span) => this.buffer!.add(span), options.tenantId);
  }

  async flush(): Promise<void> {
    if (!this.buffer) return;
    this.buffer.stop();
    const drain = this.buffer.drain();
    const timeout = new Promise<void>((resolve) =>
      setTimeout(resolve, FLUSH_TIMEOUT_MS),
    );
    await Promise.race([drain, timeout]);
  }

  private async send(spans: SpanPayload[], attempt = 1): Promise<void> {
    const payload: TracePayload = { projectId: this.projectId, spans };
    try {
      const res = await fetch(`${this.endpoint}/v1/traces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok && attempt < MAX_RETRIES) {
        await sleep(1000 * 2 ** (attempt - 1));
        return this.send(spans, attempt + 1);
      }
    } catch {
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * 2 ** (attempt - 1));
        return this.send(spans, attempt + 1);
      }
      // silent drop after max retries — never throw to caller
    }
  }
}

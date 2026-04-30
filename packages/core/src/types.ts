export type SpanKind =
  | 'llm_call'
  | 'tool_call'
  | 'agent_step'
  | 'hook'
  | 'chain'
  | 'embedding'
  | 'retriever'
  | 'custom';

export type SpanStatus = 'ok' | 'error';

export interface SpanPayload {
  id: string;
  traceId: string;
  parentSpanId: string | null;
  name: string;
  kind: SpanKind;
  startTime: number;    // Unix timestamp ms
  endTime: number;      // Unix timestamp ms
  durationMs: number;
  status: SpanStatus;
  attributes: Record<string, unknown>;
  tenantId?: string;
  // LLM-specific — filled by integrations (e.g. instrumentAnthropic)
  inputPayload?: string;
  outputPayload?: string;
  llmModel?: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  stateSnapshot?: string;
}

export interface TracePayload {
  projectId: string;
  tenantId?: string;
  environment?: 'development' | 'staging' | 'production';
  spans: SpanPayload[];
}

export interface TracelyxClientOptions {
  apiKey: string;
  projectId: string;
  endpoint?: string;
  environment?: 'development' | 'staging' | 'production';
  disabled?: boolean;
}

export interface StartTraceOptions {
  name: string;
  tenantId?: string;
  /** W3C traceparent header value for linking into an existing distributed trace. */
  traceparent?: string;
}

export interface TraceSpanOptions {
  kind?: SpanKind;
  attributes?: Record<string, unknown>;
  stateSnapshot?: string;
}

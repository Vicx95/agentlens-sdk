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
  startTime: number;   // Unix timestamp ms
  endTime: number;     // Unix timestamp ms
  durationMs: number;
  status: SpanStatus;
  attributes: Record<string, unknown>;
}

export interface TracePayload {
  projectId: string;
  tenantId?: string;
  spans: SpanPayload[];
}

export interface AgentLensClientOptions {
  apiKey: string;
  projectId: string;
  endpoint?: string;
  environment?: 'development' | 'staging' | 'production';
  disabled?: boolean;
}

export interface StartTraceOptions {
  name: string;
  tenantId?: string;
}

export interface TraceSpanOptions {
  kind?: SpanKind;
  attributes?: Record<string, unknown>;
}

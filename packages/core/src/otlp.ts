export function uuidToTraceId(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase();
}

export function uuidToSpanId(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase().slice(0, 16);
}

export function msToNano(ms: number): string {
  return (BigInt(Math.round(ms)) * 1_000_000n).toString();
}

type OtlpAnyValue =
  | { stringValue: string }
  | { intValue: string }
  | { doubleValue: number }
  | { boolValue: boolean };

export function mapAttributeValue(value: unknown): OtlpAnyValue {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
  }
  return { stringValue: JSON.stringify(value) };
}

import type { SpanPayload } from './types.js';

const SDK_VERSION = '0.1.0';

export function mapSpansToOtlp(spans: SpanPayload[], serviceName: string): unknown {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: serviceName } },
            { key: 'tracelyx.sdk.version', value: { stringValue: SDK_VERSION } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: 'tracelyx', version: SDK_VERSION },
            spans: spans.map(mapSpan),
          },
        ],
      },
    ],
  };
}

function mapSpan(span: SpanPayload): Record<string, unknown> {
  const result: Record<string, unknown> = {
    traceId: uuidToTraceId(span.traceId),
    spanId: uuidToSpanId(span.id),
    name: span.name,
    kind: 1, // INTERNAL — all our span kinds are internal processing
    startTimeUnixNano: msToNano(span.startTime),
    endTimeUnixNano: msToNano(span.endTime),
    attributes: buildAttributes(span),
    status: { code: span.status === 'ok' ? 1 : 2 },
  };
  if (span.parentSpanId !== null) {
    result.parentSpanId = uuidToSpanId(span.parentSpanId);
  }
  return result;
}

function buildAttributes(span: SpanPayload): { key: string; value: OtlpAnyValue }[] {
  const out: { key: string; value: OtlpAnyValue }[] = [];

  for (const [key, value] of Object.entries(span.attributes)) {
    if (value !== undefined && value !== null) {
      out.push({ key, value: mapAttributeValue(value) });
    }
  }

  if (span.llmModel !== undefined)
    out.push({ key: 'gen_ai.request.model', value: { stringValue: span.llmModel } });
  if (span.promptTokens !== undefined)
    out.push({ key: 'gen_ai.usage.prompt_tokens', value: { intValue: String(span.promptTokens) } });
  if (span.completionTokens !== undefined)
    out.push({ key: 'gen_ai.usage.completion_tokens', value: { intValue: String(span.completionTokens) } });
  if (span.stateSnapshot !== undefined)
    out.push({ key: 'tracelyx.state_snapshot', value: { stringValue: span.stateSnapshot } });

  return out;
}

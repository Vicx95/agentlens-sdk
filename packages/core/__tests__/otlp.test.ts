import { describe, it, expect } from 'vitest';
import { uuidToTraceId, uuidToSpanId, msToNano, mapAttributeValue, mapSpansToOtlp } from '../src/otlp.js';
import type { SpanPayload } from '../src/types.js';

describe('uuidToTraceId', () => {
  it('strips dashes to produce a 32-char hex string', () => {
    expect(uuidToTraceId('550e8400-e29b-41d4-a716-446655440000'))
      .toBe('550e8400e29b41d4a716446655440000');
  });

  it('lowercases uppercase hex digits', () => {
    expect(uuidToTraceId('550E8400-E29B-41D4-A716-446655440000'))
      .toBe('550e8400e29b41d4a716446655440000');
  });
});

describe('uuidToSpanId', () => {
  it('takes the first 16 hex chars of the UUID to produce an 8-byte span ID', () => {
    expect(uuidToSpanId('550e8400-e29b-41d4-a716-446655440000'))
      .toBe('550e8400e29b41d4');
  });

  it('lowercases and always returns exactly 16 chars', () => {
    const result = uuidToSpanId('AAAABBBB-CCCC-DDDD-EEEE-FFFF00001111');
    expect(result).toBe('aaaabbbbccccdddd');
    expect(result).toHaveLength(16);
  });
});

describe('msToNano', () => {
  it('converts milliseconds to nanosecond string', () => {
    expect(msToNano(1_000)).toBe('1000000000');
    expect(msToNano(1_234_567_890_123)).toBe('1234567890123000000');
  });

  it('handles zero', () => {
    expect(msToNano(0)).toBe('0');
  });

  it('rounds float milliseconds without precision loss', () => {
    expect(msToNano(1000.5)).toBe('1001000000');
  });
});

describe('mapAttributeValue', () => {
  it('maps string to stringValue', () => {
    expect(mapAttributeValue('hello')).toEqual({ stringValue: 'hello' });
  });

  it('maps integer number to intValue string', () => {
    expect(mapAttributeValue(42)).toEqual({ intValue: '42' });
  });

  it('maps float number to doubleValue', () => {
    expect(mapAttributeValue(3.14)).toEqual({ doubleValue: 3.14 });
  });

  it('maps boolean to boolValue', () => {
    expect(mapAttributeValue(true)).toEqual({ boolValue: true });
    expect(mapAttributeValue(false)).toEqual({ boolValue: false });
  });

  it('maps object to stringValue via JSON.stringify', () => {
    expect(mapAttributeValue({ a: 1 })).toEqual({ stringValue: '{"a":1}' });
  });

  it('maps null to stringValue "null"', () => {
    expect(mapAttributeValue(null)).toEqual({ stringValue: 'null' });
  });
});

const SAMPLE_SPAN: SpanPayload = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  traceId: '7f3d9c12-ab45-4e67-89ab-cdef01234567',
  parentSpanId: null,
  name: 'anthropic.messages.create',
  kind: 'llm_call',
  startTime: 1_000_000,
  endTime: 1_001_000,
  durationMs: 1000,
  status: 'ok',
  attributes: { 'llm.model': 'claude-3-5-sonnet', 'llm.prompt_tokens': 10 },
  llmModel: 'claude-3-5-sonnet',
  promptTokens: 10,
  completionTokens: 5,
};

describe('mapSpansToOtlp', () => {
  it('produces a valid ExportTraceServiceRequest envelope', () => {
    const result = mapSpansToOtlp([SAMPLE_SPAN], 'my-service') as any;
    expect(result.resourceSpans).toHaveLength(1);
    expect(result.resourceSpans[0].resource.attributes).toContainEqual({
      key: 'service.name',
      value: { stringValue: 'my-service' },
    });
    expect(result.resourceSpans[0].scopeSpans[0].scope.name).toBe('tracelyx');
    expect(result.resourceSpans[0].resource.attributes).toContainEqual({
      key: 'tracelyx.sdk.version',
      value: { stringValue: '0.1.0' },
    });
    expect(result.resourceSpans[0].scopeSpans[0].scope.version).toBe('0.1.0');
  });

  it('maps span IDs, timestamps, and status correctly', () => {
    const result = mapSpansToOtlp([SAMPLE_SPAN], 'svc') as any;
    const span = result.resourceSpans[0].scopeSpans[0].spans[0];

    expect(span.traceId).toBe('7f3d9c12ab454e6789abcdef01234567');
    expect(span.spanId).toBe('550e8400e29b41d4');
    expect(span.parentSpanId).toBeUndefined();
    expect(span.name).toBe('anthropic.messages.create');
    expect(span.startTimeUnixNano).toBe('1000000000000');
    expect(span.endTimeUnixNano).toBe('1001000000000');
    expect(span.status).toEqual({ code: 1 });
    expect(span.kind).toBe(1);
  });

  it('maps span.attributes and LLM top-level fields to OTLP attributes', () => {
    const result = mapSpansToOtlp([SAMPLE_SPAN], 'svc') as any;
    const span = result.resourceSpans[0].scopeSpans[0].spans[0];
    const attrMap = Object.fromEntries(
      span.attributes.map((a: any) => [a.key, a.value]),
    );

    expect(attrMap['llm.model']).toEqual({ stringValue: 'claude-3-5-sonnet' });
    expect(attrMap['llm.prompt_tokens']).toEqual({ intValue: '10' });
    expect(attrMap['gen_ai.request.model']).toEqual({ stringValue: 'claude-3-5-sonnet' });
    expect(attrMap['gen_ai.usage.prompt_tokens']).toEqual({ intValue: '10' });
    expect(attrMap['gen_ai.usage.completion_tokens']).toEqual({ intValue: '5' });
  });

  it('maps error status to OTLP status code 2', () => {
    const errSpan: SpanPayload = { ...SAMPLE_SPAN, status: 'error' };
    const result = mapSpansToOtlp([errSpan], 'svc') as any;
    expect(result.resourceSpans[0].scopeSpans[0].spans[0].status.code).toBe(2);
  });

  it('includes parentSpanId when set', () => {
    const childSpan: SpanPayload = {
      ...SAMPLE_SPAN,
      parentSpanId: 'aaaabbbb-cccc-dddd-eeee-ffff00001111',
    };
    const result = mapSpansToOtlp([childSpan], 'svc') as any;
    expect(result.resourceSpans[0].scopeSpans[0].spans[0].parentSpanId)
      .toBe('aaaabbbbccccdddd');
  });

  it('maps stateSnapshot to tracelyx.state_snapshot attribute', () => {
    const spanWithState: SpanPayload = { ...SAMPLE_SPAN, stateSnapshot: '{"x":1}' };
    const result = mapSpansToOtlp([spanWithState], 'svc') as any;
    const attrMap = Object.fromEntries(
      result.resourceSpans[0].scopeSpans[0].spans[0].attributes.map((a: any) => [a.key, a.value]),
    );
    expect(attrMap['tracelyx.state_snapshot']).toEqual({ stringValue: '{"x":1}' });
  });

  it('omits gen_ai.* attributes when LLM fields are absent', () => {
    const plainSpan: SpanPayload = {
      ...SAMPLE_SPAN,
      llmModel: undefined,
      promptTokens: undefined,
      completionTokens: undefined,
      stateSnapshot: undefined,
    };
    const result = mapSpansToOtlp([plainSpan], 'svc') as any;
    const keys = result.resourceSpans[0].scopeSpans[0].spans[0].attributes.map(
      (a: any) => a.key,
    );
    expect(keys).not.toContain('gen_ai.request.model');
    expect(keys).not.toContain('gen_ai.usage.prompt_tokens');
    expect(keys).not.toContain('gen_ai.usage.completion_tokens');
    expect(keys).not.toContain('tracelyx.state_snapshot');
  });
});

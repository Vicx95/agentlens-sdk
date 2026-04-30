import { describe, it, expect } from 'vitest';
import { Trace, parseTraceparent } from '../src/tracer.js';
import type { SpanPayload } from '../src/types.js';

const VALID_TRACEPARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

describe('parseTraceparent', () => {
  it('parses a valid traceparent header', () => {
    const result = parseTraceparent(VALID_TRACEPARENT);
    expect(result).toEqual({
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      parentSpanId: '00f067aa0ba902b7',
    });
  });

  it('returns null for wrong number of segments', () => {
    expect(parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-01')).toBeNull();
  });

  it('returns null for unsupported version', () => {
    expect(parseTraceparent('ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')).toBeNull();
  });

  it('returns null for traceId with wrong length', () => {
    expect(parseTraceparent('00-4bf92f-00f067aa0ba902b7-01')).toBeNull();
  });

  it('returns null for parentSpanId with wrong length', () => {
    expect(parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067-01')).toBeNull();
  });

  it('returns null for all-zero traceId', () => {
    expect(parseTraceparent('00-00000000000000000000000000000000-00f067aa0ba902b7-01')).toBeNull();
  });

  it('returns null for all-zero parentSpanId', () => {
    expect(parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01')).toBeNull();
  });

  it('returns null for non-hex characters', () => {
    expect(parseTraceparent('00-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-00f067aa0ba902b7-01')).toBeNull();
  });
});

describe('Trace with traceparent', () => {
  it('uses traceId from traceparent instead of generating one', () => {
    const captured: SpanPayload[] = [];
    const trace = new Trace((p) => captured.push(p), undefined, 'test', VALID_TRACEPARENT);

    const span = trace.startSpan('root', 'custom');
    span.end();

    expect(trace.id).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(captured[0].traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  });

  it('sets parentSpanId from traceparent on root spans', () => {
    const captured: SpanPayload[] = [];
    const trace = new Trace((p) => captured.push(p), undefined, 'test', VALID_TRACEPARENT);

    const span = trace.startSpan('root', 'custom');
    span.end();

    expect(captured[0].parentSpanId).toBe('00f067aa0ba902b7');
  });

  it('ignores invalid traceparent and generates a fresh traceId', () => {
    const captured: SpanPayload[] = [];
    const trace = new Trace((p) => captured.push(p), undefined, 'test', 'not-valid');

    const span = trace.startSpan('root', 'custom');
    span.end();

    expect(trace.id).not.toBe('');
    expect(trace.id).not.toBe('not-valid');
    expect(captured[0].parentSpanId).toBeNull();
  });

  it('child spans still inherit parent from AsyncLocalStorage, not external context', async () => {
    const captured: SpanPayload[] = [];
    const trace = new Trace((p) => captured.push(p), undefined, 'test', VALID_TRACEPARENT);

    await trace.trace('root', async () => {
      const child = trace.startSpan('child', 'tool_call');
      child.end();
    });

    const root = captured.find((s) => s.name === 'root')!;
    const child = captured.find((s) => s.name === 'child')!;

    expect(root.parentSpanId).toBe('00f067aa0ba902b7');
    expect(child.parentSpanId).toBe(root.id);
  });
});

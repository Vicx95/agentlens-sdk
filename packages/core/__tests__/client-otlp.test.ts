import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TracelyxClient } from '../src/client.js';

describe('TracelyxClient with OTLP', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sends to both native and OTLP endpoints when both are configured', async () => {
    const client = new TracelyxClient({
      apiKey: 'tl_test',
      projectId: 'proj',
      otlp: { endpoint: 'http://collector:4318' },
    });

    const trace = client.startTrace({ name: 'run' });
    trace.startSpan('step', 'custom').end();
    await client.flush();

    const urls = fetchMock.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(urls).toContain('https://ingest.tracelyx.dev/v1/traces');
    expect(urls).toContain('http://collector:4318/v1/traces');
  });

  it('OTLP payload is a valid ExportTraceServiceRequest', async () => {
    const client = new TracelyxClient({
      apiKey: 'tl_test',
      projectId: 'proj',
      otlp: { endpoint: 'http://collector:4318', serviceName: 'my-app' },
    });

    const trace = client.startTrace({ name: 'run' });
    const span = trace.startSpan('llm-call', 'llm_call');
    span.setAttribute('llm.model', 'gpt-4');
    span.end();
    await client.flush();

    const otlpCall = fetchMock.mock.calls.find(
      (c: unknown[]) => c[0] === 'http://collector:4318/v1/traces',
    )!;
    const body = JSON.parse((otlpCall[1] as RequestInit).body as string) as any;

    expect(body.resourceSpans[0].resource.attributes).toContainEqual({
      key: 'service.name',
      value: { stringValue: 'my-app' },
    });
    const otlpSpan = body.resourceSpans[0].scopeSpans[0].spans[0];
    expect(otlpSpan.name).toBe('llm-call');
    expect(otlpSpan.status.code).toBe(1);
    const attrMap = Object.fromEntries(otlpSpan.attributes.map((a: any) => [a.key, a.value]));
    expect(attrMap['llm.model']).toEqual({ stringValue: 'gpt-4' });
  });

  it('sends only to native endpoint when no otlp config', async () => {
    const client = new TracelyxClient({ apiKey: 'tl_test', projectId: 'proj' });
    client.startTrace({ name: 'run' }).startSpan('s', 'custom').end();
    await client.flush();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('https://ingest.tracelyx.dev/v1/traces');
  });
});

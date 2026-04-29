import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OtlpExporter } from '../src/otlp.js';
import type { SpanPayload } from '../src/types.js';

const SAMPLE_SPAN: SpanPayload = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  traceId: '7f3d9c12-ab45-4e67-89ab-cdef01234567',
  parentSpanId: null,
  name: 'test-span',
  kind: 'custom',
  startTime: 1_000_000,
  endTime: 1_001_000,
  durationMs: 1000,
  status: 'ok',
  attributes: {},
};

describe('OtlpExporter', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('POSTs to {endpoint}/v1/traces with correct headers', async () => {
    const exporter = new OtlpExporter({ endpoint: 'http://localhost:4318', serviceName: 'my-svc' });
    await exporter.send([SAMPLE_SPAN]);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4318/v1/traces');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('includes custom headers in the request', async () => {
    const exporter = new OtlpExporter({
      endpoint: 'http://collector:4318',
      headers: { 'X-Auth-Token': 'secret' },
    });
    await exporter.send([SAMPLE_SPAN]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Auth-Token']).toBe('secret');
  });

  it('uses "tracelyx" as default service name when not specified', async () => {
    const exporter = new OtlpExporter({ endpoint: 'http://localhost:4318' });
    await exporter.send([SAMPLE_SPAN]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as any;
    const serviceAttr = body.resourceSpans[0].resource.attributes.find(
      (a: any) => a.key === 'service.name',
    );
    expect(serviceAttr.value.stringValue).toBe('tracelyx');
  });

  it('silently swallows network errors', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));
    const exporter = new OtlpExporter({ endpoint: 'http://localhost:4318' });
    await expect(exporter.send([SAMPLE_SPAN])).resolves.toBeUndefined();
  });

  it('silently swallows non-2xx responses', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));
    const exporter = new OtlpExporter({ endpoint: 'http://localhost:4318' });
    await expect(exporter.send([SAMPLE_SPAN])).resolves.toBeUndefined();
  });

  it('strips trailing slash from endpoint', async () => {
    const exporter = new OtlpExporter({ endpoint: 'http://localhost:4318/' });
    await exporter.send([SAMPLE_SPAN]);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4318/v1/traces');
  });
});

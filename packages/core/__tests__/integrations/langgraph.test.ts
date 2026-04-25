import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { instrumentLangGraph } from '../../src/integrations/langgraph.js';
import { TracelyxClient } from '../../src/client.js';
import type { TracePayload } from '../../src/types.js';

function makeGraphMock(returnValue: unknown) {
  return { invoke: vi.fn().mockResolvedValue(returnValue) };
}

describe('instrumentLangGraph', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: TracelyxClient;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response('{"accepted":1}', { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    client = new TracelyxClient({ apiKey: 'tl_test', projectId: 'proj_1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('wraps invoke() and creates an agent_step span', async () => {
    const graph = makeGraphMock({ result: 'done' });
    instrumentLangGraph(graph, client);

    await graph.invoke({ input: 'hello' }, { configurable: { thread_id: 'thread-1' } });

    await client.flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as TracePayload;
    const span = body.spans[0];

    expect(span.kind).toBe('agent_step');
    expect(span.name).toBe('langgraph.invoke');
    expect(span.attributes['langgraph.thread_id']).toBe('thread-1');
    expect(span.durationMs).toBeGreaterThanOrEqual(0);
    expect(span.status).toBe('ok');
  });

  it('records error status when invoke throws', async () => {
    const graph = { invoke: vi.fn().mockRejectedValue(new Error('graph failed')) };
    instrumentLangGraph(graph, client);

    await expect(graph.invoke({})).rejects.toThrow('graph failed');

    await client.flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as TracePayload;
    expect(body.spans[0].status).toBe('error');
    expect(body.spans[0].attributes['error.message']).toBe('graph failed');
  });

  it('is idempotent — second call does not double-wrap', async () => {
    const graph = makeGraphMock({});
    instrumentLangGraph(graph, client);
    instrumentLangGraph(graph, client);

    await graph.invoke({});
    await client.flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as TracePayload;
    expect(body.spans).toHaveLength(1);
  });

  it('links to parent trace when called inside trace.trace()', async () => {
    const graph = makeGraphMock({});
    instrumentLangGraph(graph, client);

    const trace = client.startTrace({ name: 'outer' });
    await trace.trace('orchestrate', async () => {
      await graph.invoke({});
    });

    await client.flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as TracePayload;
    const lgSpan = body.spans.find((s) => s.name === 'langgraph.invoke')!;
    const parentSpan = body.spans.find((s) => s.name === 'orchestrate')!;

    expect(lgSpan.parentSpanId).toBe(parentSpan.id);
    expect(lgSpan.traceId).toBe(parentSpan.traceId);
  });
});

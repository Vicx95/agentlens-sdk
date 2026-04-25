import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { instrumentOpenAIAgents } from '../../src/integrations/openai-agents.js';
import { TracelyxClient } from '../../src/client.js';
import type { TracePayload } from '../../src/types.js';

describe('instrumentOpenAIAgents', () => {
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

  it('wraps agent.run() and creates an agent_step span', async () => {
    const agent = {
      name: 'SupportAgent',
      model: 'gpt-4o',
      run: vi.fn().mockResolvedValue({ output: 'done' }),
    };

    instrumentOpenAIAgents(agent, client);
    await agent.run('User question', {});

    await client.flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as TracePayload;
    const span = body.spans[0];

    expect(span.kind).toBe('agent_step');
    expect(span.name).toBe('agent.SupportAgent');
    expect(span.attributes['agent.name']).toBe('SupportAgent');
    expect(span.attributes['openai.model']).toBe('gpt-4o');
    expect(span.status).toBe('ok');
  });

  it('records error status when run() throws', async () => {
    const agent = {
      name: 'FailAgent',
      run: vi.fn().mockRejectedValue(new Error('agent failed')),
    };

    instrumentOpenAIAgents(agent, client);

    await expect(agent.run('input')).rejects.toThrow('agent failed');
    await client.flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as TracePayload;
    expect(body.spans[0].status).toBe('error');
    expect(body.spans[0].attributes['error.message']).toBe('agent failed');
  });

  it('is idempotent — second call does not double-wrap', async () => {
    const agent = { name: 'A', run: vi.fn().mockResolvedValue({}) };

    instrumentOpenAIAgents(agent, client);
    instrumentOpenAIAgents(agent, client);

    await agent.run('x');
    await client.flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as TracePayload;
    expect(body.spans).toHaveLength(1);
  });

  it('links to parent trace via AsyncLocalStorage', async () => {
    const agent = { name: 'InnerAgent', run: vi.fn().mockResolvedValue({}) };
    instrumentOpenAIAgents(agent, client);

    const trace = client.startTrace({ name: 'pipeline' });
    await trace.trace('orchestrate', async () => {
      await agent.run('task');
    });

    await client.flush();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as TracePayload;
    const agentSpan = body.spans.find((s) => s.name === 'agent.InnerAgent')!;
    const parentSpan = body.spans.find((s) => s.name === 'orchestrate')!;

    expect(agentSpan.parentSpanId).toBe(parentSpan.id);
    expect(agentSpan.traceId).toBe(parentSpan.traceId);
  });
});

import { randomUUID } from 'crypto';
import { getActiveContext } from '../tracer.js';
import type { TracelyxClient } from '../client.js';
import type { SpanPayload } from '../types.js';

const INSTRUMENTED = Symbol('tracelyx.instrumented');

interface AgentLike {
  name?: string;
  model?: string;
  run(...args: unknown[]): Promise<unknown>;
  [key: string | symbol]: unknown;
}

export function instrumentOpenAIAgents<T extends AgentLike>(
  agent: T,
  tracelyxClient: TracelyxClient,
): T {
  const agentAsAny = agent as any;
  if (agentAsAny[INSTRUMENTED]) return agent;

  const originalRun = agentAsAny.run.bind(agentAsAny);
  const agentName = agentAsAny.name ?? 'unknown';

  agentAsAny.run = async function (...args: unknown[]): Promise<unknown> {
    const ctx = getActiveContext();
    const spanId = randomUUID();
    const traceId = ctx?.traceId ?? randomUUID();
    const parentSpanId = ctx?.spanId ?? null;
    const startTime = Date.now();

    const attributes: Record<string, unknown> = {
      'agent.name': agentName,
      ...(agentAsAny.model !== undefined && { 'openai.model': agentAsAny.model }),
    };

    let status: 'ok' | 'error' = 'ok';

    try {
      return await originalRun(...args);
    } catch (error) {
      status = 'error';
      if (error instanceof Error) {
        attributes['error.message'] = error.message;
        attributes['error.stack'] = error.stack;
      }
      throw error;
    } finally {
      const endTime = Date.now();
      const span: SpanPayload = {
        id: spanId,
        traceId,
        parentSpanId,
        name: `agent.${agentName}`,
        kind: 'agent_step',
        startTime,
        endTime,
        durationMs: endTime - startTime,
        status,
        attributes,
      };
      tracelyxClient.recordSpan(span);
    }
  };

  agentAsAny[INSTRUMENTED] = true;
  return agent;
}

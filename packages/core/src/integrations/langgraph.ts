import { randomUUID } from 'crypto';
import { getActiveContext } from '../tracer.js';
import type { TracelyxClient } from '../client.js';
import type { SpanPayload } from '../types.js';

const INSTRUMENTED = Symbol('tracelyx.instrumented');

interface LangGraphConfig {
  configurable?: {
    thread_id?: string;
    checkpoint_id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface CompiledGraphLike {
  invoke(input: unknown, config?: LangGraphConfig): Promise<unknown>;
  [key: string | symbol]: unknown;
}

export function instrumentLangGraph<T extends CompiledGraphLike>(
  graph: T,
  tracelyxClient: TracelyxClient,
): T {
  const graphAsAny = graph as any;
  if (graphAsAny[INSTRUMENTED]) return graph;

  const originalInvoke = graphAsAny.invoke.bind(graphAsAny);

  graphAsAny.invoke = async function (input: unknown, config?: LangGraphConfig): Promise<unknown> {
    const ctx = getActiveContext();
    const spanId = randomUUID();
    const traceId = ctx?.traceId ?? randomUUID();
    const parentSpanId = ctx?.spanId ?? null;
    const startTime = Date.now();

    const attributes: Record<string, unknown> = {
      'langgraph.thread_id': config?.configurable?.thread_id,
      'langgraph.checkpoint_id': config?.configurable?.checkpoint_id,
    };

    let status: 'ok' | 'error' = 'ok';

    try {
      return await originalInvoke(input, config);
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
        name: 'langgraph.invoke',
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

  graphAsAny[INSTRUMENTED] = true;
  return graph;
}

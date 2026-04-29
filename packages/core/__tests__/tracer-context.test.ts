import { describe, it, expect } from 'vitest';
import { getActiveContext, runWithContext } from '../src/tracer.js';

describe('runWithContext', () => {
  it('makes context visible inside the callback via getActiveContext()', async () => {
    const ctx = { spanId: 'span-abc', traceId: 'trace-xyz' };
    let seen: ReturnType<typeof getActiveContext>;

    await runWithContext(ctx, async () => {
      seen = getActiveContext();
    });

    expect(seen).toEqual(ctx);
  });

  it('restores previous context after callback completes', async () => {
    const outer = { spanId: 'outer', traceId: 'trace-1' };
    let inner: ReturnType<typeof getActiveContext>;
    let after: ReturnType<typeof getActiveContext>;

    await runWithContext(outer, async () => {
      await runWithContext({ spanId: 'inner', traceId: 'trace-1' }, async () => {
        inner = getActiveContext();
      });
      after = getActiveContext();
    });

    expect(inner?.spanId).toBe('inner');
    expect(after?.spanId).toBe('outer');
  });

  it('propagates tenantId through context', async () => {
    const ctx = { spanId: 'span-1', traceId: 'trace-1', tenantId: 'my-tenant' };
    let seen: ReturnType<typeof getActiveContext>;

    await runWithContext(ctx, async () => {
      seen = getActiveContext();
    });

    expect(seen?.tenantId).toBe('my-tenant');
  });

  it('allows undefined tenantId for backward compatibility', async () => {
    const ctx = { spanId: 'span-2', traceId: 'trace-2' };
    let seen: ReturnType<typeof getActiveContext>;

    await runWithContext(ctx, async () => {
      seen = getActiveContext();
    });

    expect(seen?.tenantId).toBeUndefined();
  });
});

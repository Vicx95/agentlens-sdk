import { describe, it, expect } from 'vitest';
import { getActiveContext, runWithContext } from '../src/tracer.js';

describe('runWithContext', () => {
  it('makes context visible inside the callback via getActiveContext()', async () => {
    const ctx = { spanId: 'span-abc', traceId: 'trace-xyz' };
    let seen: { spanId: string; traceId: string } | undefined;

    await runWithContext(ctx, async () => {
      seen = getActiveContext();
    });

    expect(seen).toEqual(ctx);
  });

  it('restores previous context after callback completes', async () => {
    const outer = { spanId: 'outer', traceId: 'trace-1' };
    let inner: { spanId: string; traceId: string } | undefined;
    let after: { spanId: string; traceId: string } | undefined;

    await runWithContext(outer, async () => {
      await runWithContext({ spanId: 'inner', traceId: 'trace-1' }, async () => {
        inner = getActiveContext();
      });
      after = getActiveContext();
    });

    expect(inner?.spanId).toBe('inner');
    expect(after?.spanId).toBe('outer');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runHookCommand } from '../../bin/tracelyx.js';
import type { TracePayload } from '../../src/types.js';

describe('hook command', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response('{"accepted":1}', { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends a hook span with correct attributes', async () => {
    vi.stubEnv('TRACELYX_API_KEY', 'tl_test');
    vi.stubEnv('TRACELYX_PROJECT_ID', 'proj_1');

    const hookData = {
      session_id: 'sess-abc',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    };

    await runHookCommand(['--event', 'PreToolUse'], JSON.stringify(hookData));

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as TracePayload;
    const span = body.spans[0];

    expect(span.kind).toBe('hook');
    expect(span.name).toBe('hook.PreToolUse');
    expect(span.traceId).toBe('sess-abc');
    expect(span.parentSpanId).toBeNull();
    expect(span.attributes['hook.tool_name']).toBe('Bash');
    expect(span.attributes['hook.session_id']).toBe('sess-abc');
    expect(span.attributes['hook.original_input']).toBe(JSON.stringify({ command: 'ls' }));
  });

  it('exits silently (no fetch) when API key is not configured', async () => {
    vi.stubEnv('TRACELYX_API_KEY', '');
    vi.stubEnv('TRACELYX_PROJECT_ID', '');

    await runHookCommand(['--event', 'PreToolUse'], '{}');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exits silently when stdin is invalid JSON', async () => {
    vi.stubEnv('TRACELYX_API_KEY', 'tl_test');
    vi.stubEnv('TRACELYX_PROJECT_ID', 'proj_1');

    await expect(runHookCommand(['--event', 'Stop'], 'not-json')).resolves.not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('generates random traceId when session_id is absent', async () => {
    vi.stubEnv('TRACELYX_API_KEY', 'tl_test');
    vi.stubEnv('TRACELYX_PROJECT_ID', 'proj_1');

    await runHookCommand(['--event', 'PostToolUse'], '{}');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as TracePayload;
    expect(body.spans[0].traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

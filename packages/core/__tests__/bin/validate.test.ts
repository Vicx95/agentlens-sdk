import { describe, it, expect, vi, afterEach } from 'vitest';
import { runValidateCommand } from '../../bin/tracelyx.js';

describe('validate command', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('exits 0 and prints success when server returns 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"accepted":1}', { status: 200 })),
    );

    const stdoutLines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutLines.push(String(chunk));
      return true;
    });

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`exit(${code})`);
      }) as (code?: number) => never);

    try {
      await runValidateCommand(['--api-key', 'tl_test', '--project-id', 'proj_1']);
    } catch {
      // expected to throw when process.exit is mocked
    }

    expect(exitSpy).toHaveBeenCalledWith(0);
    const output = stdoutLines.join('');
    expect(output).toContain('✓ Tracelyx configured correctly');
  });

  it('exits 1 and prints error when server returns 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 401 })),
    );

    const stdoutLines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutLines.push(String(chunk));
      return true;
    });

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`exit(${code})`);
      }) as (code?: number) => never);

    try {
      await runValidateCommand(['--api-key', 'tl_invalid', '--project-id', 'proj_1']);
    } catch {
      // expected to throw when process.exit is mocked
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = stdoutLines.join('');
    expect(output).toContain('invalid or expired');
  });

  it('exits 1 without calling fetch when api-key is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const stdoutLines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutLines.push(String(chunk));
      return true;
    });

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`exit(${code})`);
      }) as (code?: number) => never);

    try {
      await runValidateCommand(['--project-id', 'proj_1']); // no --api-key
    } catch {
      // expected to throw when process.exit is mocked
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exits 1 without calling fetch when project-id is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const stdoutLines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutLines.push(String(chunk));
      return true;
    });

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`exit(${code})`);
      }) as (code?: number) => never);

    try {
      await runValidateCommand(['--api-key', 'tl_test']); // no --project-id
    } catch {
      // expected to throw when process.exit is mocked
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('outputs JSON when --json flag is set', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"accepted":1}', { status: 200 })),
    );

    const stdoutLines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutLines.push(String(chunk));
      return true;
    });

    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit(${code})`);
    }) as (code?: number) => never);

    try {
      await runValidateCommand(['--api-key', 'tl_test', '--project-id', 'proj_1', '--json']);
    } catch {
      // expected to throw when process.exit is mocked
    }

    const output = stdoutLines.join('').trim();
    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    expect(typeof parsed.message).toBe('string');
  });

  it('sends correct payload with tenant when --tenant is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"accepted":1}', { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const stdoutLines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutLines.push(String(chunk));
      return true;
    });

    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit(${code})`);
    }) as (code?: number) => never);

    try {
      await runValidateCommand(['--api-key', 'tl_test', '--project-id', 'proj_1', '--tenant', 'tenant_123']);
    } catch {
      // expected to throw when process.exit is mocked
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    const callArgs = fetchMock.mock.calls[0];
    const payload = JSON.parse(callArgs[1].body);
    expect(payload.tenantId).toBe('tenant_123');
    expect(payload.projectId).toBe('proj_1');
  });

  it('exits 1 on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    const stdoutLines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutLines.push(String(chunk));
      return true;
    });

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`exit(${code})`);
      }) as (code?: number) => never);

    try {
      await runValidateCommand(['--api-key', 'tl_test', '--project-id', 'proj_1']);
    } catch {
      // expected to throw when process.exit is mocked
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = stdoutLines.join('');
    expect(output).toContain('Cannot reach');
  });

  it('exits 1 on server error with non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 500 })),
    );

    const stdoutLines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutLines.push(String(chunk));
      return true;
    });

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`exit(${code})`);
      }) as (code?: number) => never);

    try {
      await runValidateCommand(['--api-key', 'tl_test', '--project-id', 'proj_1']);
    } catch {
      // expected to throw when process.exit is mocked
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = stdoutLines.join('');
    expect(output).toContain('Server returned');
  });

  it('reads api-key from TRACELYX_API_KEY env when --api-key arg is not provided', async () => {
    vi.stubEnv('TRACELYX_API_KEY', 'tl_from_env');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"accepted":1}', { status: 200 })),
    );

    const stdoutLines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutLines.push(String(chunk));
      return true;
    });

    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit(${code})`);
    }) as (code?: number) => never);

    try {
      await runValidateCommand(['--project-id', 'proj_1']);
    } catch {
      // expected to throw when process.exit is mocked
    }

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const callArgs = fetchMock.mock.calls[0];
    const headers = callArgs[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tl_from_env');
  });

  it('reads project-id from TRACELYX_PROJECT_ID env when --project-id arg is not provided', async () => {
    vi.stubEnv('TRACELYX_PROJECT_ID', 'proj_from_env');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"accepted":1}', { status: 200 })),
    );

    const stdoutLines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutLines.push(String(chunk));
      return true;
    });

    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit(${code})`);
    }) as (code?: number) => never);

    try {
      await runValidateCommand(['--api-key', 'tl_test']);
    } catch {
      // expected to throw when process.exit is mocked
    }

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const callArgs = fetchMock.mock.calls[0];
    const payload = JSON.parse(callArgs[1].body);
    expect(payload.projectId).toBe('proj_from_env');
  });
});

import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { startServer } from '../src/server.js';
import { getLocalStack } from './helpers/stack.js';

const { apiUrl, dbUrl } = getLocalStack();
const apiDir = fileURLToPath(new URL('..', import.meta.url));
const baseEnv = { SUPABASE_URL: apiUrl, DATABASE_URL: dbUrl, HOST: '127.0.0.1' };

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

interface Child {
  process: ChildProcess;
  port: number;
  stdout: () => string;
  stderr: () => string;
  exit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

/** Runs the real entry point (`src/server.ts`) in its own process, as `pnpm dev` would. */
function startChild(env: Record<string, string | undefined>, port: number): Child {
  let out = '';
  let err = '';
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: apiDir,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env, PORT: String(port) } as NodeJS.ProcessEnv,
  });
  child.stdout?.on('data', (chunk) => (out += chunk));
  child.stderr?.on('data', (chunk) => (err += chunk));
  const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
    child.once('exit', (code, signal) => resolve({ code, signal })),
  );
  return { process: child, port, stdout: () => out, stderr: () => err, exit };
}

async function waitHealthy(child: Child): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${child.port}/health`);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`server did not become healthy.\nstdout: ${child.stdout()}\nstderr: ${child.stderr()}`);
}

const running: Child[] = [];
afterEach(() => {
  for (const child of running.splice(0)) child.process.kill('SIGKILL');
});

describe('startServer (SRV-01)', () => {
  it('listens and serves GET /health over real HTTP, then stops listening on close', async () => {
    const server = await startServer({ ...baseEnv }, { port: 0, logLevel: 'silent' });
    try {
      const response = await fetch(`${server.address}/health`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok' });
    } finally {
      await server.close();
    }
    await expect(fetch(`${server.address}/health`)).rejects.toThrow();
  });

  it('rejects an invalid PORT from the environment citing PORT', async () => {
    await expect(startServer({ ...baseEnv, PORT: '70000' })).rejects.toThrow(/PORT/);
  });
});

describe('the server process (SRV-03, SRV-02, SRV-04)', () => {
  it.each(['SIGTERM', 'SIGINT'] as const)('exits with code 0 and stops listening after %s', async (signal) => {
    const child = startChild({ ...baseEnv, LOG_LEVEL: 'silent' }, await freePort());
    running.push(child);
    await waitHealthy(child);
    child.process.kill(signal);
    expect(await child.exit).toEqual({ code: 0, signal: null });
    await expect(fetch(`http://127.0.0.1:${child.port}/health`)).rejects.toThrow();
  });

  it.each(['SUPABASE_URL', 'DATABASE_URL'])('exits non-zero naming %s when it is missing', async (name) => {
    const child = startChild({ ...baseEnv, [name]: undefined }, await freePort());
    running.push(child);
    const { code } = await child.exit;
    expect(code).not.toBe(0);
    expect(code).not.toBeNull();
    expect(child.stderr()).toContain(name);
  });

  it('exits non-zero naming PORT when it is invalid', async () => {
    const child = startChild({ ...baseEnv }, 0);
    running.push(child);
    const { code } = await child.exit;
    expect(code).not.toBe(0);
    expect(child.stderr()).toContain('PORT');
  });

  it('logs requests as JSON without ever writing the Authorization token', async () => {
    const token = 'tkn-should-never-appear-in-logs-9f3b7c';
    const child = startChild({ ...baseEnv, LOG_LEVEL: 'info' }, await freePort());
    running.push(child);
    await waitHealthy(child);
    const unauthorized = await fetch(`http://127.0.0.1:${child.port}/accounts`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(unauthorized.status).toBe(401);
    child.process.kill('SIGTERM');
    await child.exit;

    const lines = child
      .stdout()
      .split('\n')
      .filter((line) => line.trim() !== '');
    const records = lines.map((line) => JSON.parse(line) as { req?: { url?: string }; res?: { statusCode?: number } });
    expect(records.some((record) => record.req?.url === '/accounts')).toBe(true);
    expect(records.some((record) => record.res?.statusCode === 401)).toBe(true);
    expect(child.stdout()).not.toContain(token);
    expect(child.stderr()).not.toContain(token);
  });
});

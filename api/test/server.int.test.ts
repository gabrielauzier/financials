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

  it('releases the database pool on close: a query after close fails with CONNECTION_ENDED (SRV-03)', async () => {
    const server = await startServer({ ...baseEnv }, { port: 0, logLevel: 'silent' });
    const claims = { sub: '6f1c0a52-0000-4000-8000-000000000001' };
    const rows = await server.app.withUser(claims, (tx) => tx`select 1 as one`);
    expect(rows[0]).toEqual({ one: 1 });
    await server.close();
    await expect(server.app.withUser(claims, (tx) => tx`select 1`)).rejects.toMatchObject({
      code: 'CONNECTION_ENDED',
    });
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

  it.each(['SIGTERM', 'SIGINT'] as const)(
    'closes the database pool and the app before exiting after %s (SRV-03)',
    async (signal) => {
      const child = startChild({ ...baseEnv, LOG_LEVEL: 'info' }, await freePort());
      running.push(child);
      await waitHealthy(child);
      child.process.kill(signal);
      expect(await child.exit).toEqual({ code: 0, signal: null });
      const messages = child
        .stdout()
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => (JSON.parse(line) as { msg?: string }).msg);
      // Only `app.close()` runs the db plugin's onClose hook, so a bare process.exit(0) cannot fake these.
      const closed = messages.indexOf('database pool closed');
      const complete = messages.indexOf('shutdown complete');
      expect(closed).toBeGreaterThan(-1);
      expect(complete).toBeGreaterThan(closed);
    },
  );

  it.each(['SUPABASE_URL', 'DATABASE_URL'])('exits non-zero naming %s when it is missing', async (name) => {
    const child = startChild({ ...baseEnv, [name]: undefined }, await freePort());
    running.push(child);
    const { code } = await child.exit;
    expect(code).not.toBe(0);
    expect(code).not.toBeNull();
    expect(child.stderr()).toContain(name);
  });

  it('closes the app and exits 1 when the port is already in use (SRV-01)', async () => {
    const port = await freePort();
    const holder = createServer();
    await new Promise<void>((resolve) => holder.listen(port, '127.0.0.1', resolve));
    try {
      const child = startChild({ ...baseEnv, LOG_LEVEL: 'info' }, port);
      running.push(child);
      const { code } = await child.exit;
      expect(code).toBe(1);
      expect(child.stderr()).toMatch(/EADDRINUSE|address already in use/i);
      // The app is closed after the failed listen, which runs the db plugin's onClose hook.
      expect(child.stdout()).toContain('database pool closed');
    } finally {
      await new Promise<void>((resolve) => holder.close(() => resolve()));
    }
  });

  it('exits non-zero naming PORT when it is invalid', async () => {
    const child = startChild({ ...baseEnv }, 0);
    running.push(child);
    const { code } = await child.exit;
    expect(code).not.toBeNull();
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

  it('logs only the path of a request: a token or search text in the query string never reaches the logs', async () => {
    const secret = 'qs-secret-must-not-be-logged-41d8';
    const child = startChild({ ...baseEnv, LOG_LEVEL: 'info' }, await freePort());
    running.push(child);
    await waitHealthy(child);
    await fetch(`http://127.0.0.1:${child.port}/accounts?access_token=${secret}&q=${secret}`);
    child.process.kill('SIGTERM');
    await child.exit;
    const records = child
      .stdout()
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as { req?: { url?: string } });
    expect(records.some((record) => record.req?.url === '/accounts')).toBe(true);
    expect(child.stdout()).not.toContain(secret);
  });
});

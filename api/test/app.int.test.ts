import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('GET /health', () => {
  it('returns 200 with { status: "ok" } and no token', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('stays public even with a malformed Authorization header', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { authorization: 'Bearer not-a-jwt' },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('can be built repeatedly without binding a port', async () => {
    const first = buildApp();
    const second = buildApp();
    expect(first).not.toBe(second);
    const [a, b] = await Promise.all([
      first.inject({ method: 'GET', url: '/health' }),
      second.inject({ method: 'GET', url: '/health' }),
    ]);
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(first.server.listening).toBe(false);
    expect(second.server.listening).toBe(false);
    await Promise.all([first.close(), second.close()]);
  });
});

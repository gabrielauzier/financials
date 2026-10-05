import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { SignJWT, generateKeyPair } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AppConfig } from '../src/config.js';
import { cleanupTestUsers, closeAdminSql, createTestUser } from './helpers/db.js';
import { getLocalStack } from './helpers/stack.js';

const now = () => Math.floor(Date.now() / 1000);
const HS256_SECRET = 'integration-test-secret-with-32-characters';

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  const { apiUrl, dbUrl } = getLocalStack();
  return { supabaseUrl: apiUrl, databaseUrl: dbUrl, ...overrides };
}

/** The protected sample route exists only in this test. */
async function appWithSampleRoute(cfg: AppConfig): Promise<FastifyInstance> {
  const app = buildApp(cfg);
  app.get('/test/protected', async (request) => {
    const [row] = await request.withUser(
      (tx) => tx<{ uid: string }[]>`select auth.uid()::text as uid`,
    );
    return { userId: request.user?.id, dbUid: row?.uid };
  });
  // Does NOT call request.withUser: only the onRequest hook can answer 401 here.
  app.get('/test/whoami', async (request) => ({ userId: request.user?.id ?? null }));
  await app.ready();
  return app;
}

let jwksApp: FastifyInstance;

beforeAll(async () => {
  jwksApp = await appWithSampleRoute(config());
});

afterAll(async () => {
  await jwksApp.close();
  await cleanupTestUsers();
  await closeAdminSql();
});

const get = (app: FastifyInstance, authorization?: string) =>
  app.inject({
    method: 'GET',
    url: '/test/protected',
    headers: authorization === undefined ? {} : { authorization },
  });

function expectUnauthorized(res: Awaited<ReturnType<typeof get>>): void {
  expect(res.statusCode).toBe(401);
  expect(res.json()).toEqual({ error: { code: 'unauthorized', message: expect.any(String) } });
}

describe('auth hook on a protected route', () => {
  it('returns 401 without a token', async () => {
    expectUnauthorized(await get(jwksApp));
    expectUnauthorized(await get(jwksApp, 'Basic dXNlcjpwYXNz'));
  });

  it('returns 401 with a malformed token', async () => {
    expectUnauthorized(await get(jwksApp, 'Bearer not-a-jwt'));
    expectUnauthorized(await get(jwksApp, 'Bearer '));
  });

  it('returns 401 with an expired token or a token with an invalid signature', async () => {
    // Expired: HS256 fallback mode, token signed with the configured secret but past exp.
    const hsApp = await appWithSampleRoute(config({ jwtSecret: HS256_SECRET }));
    try {
      const expired = await new SignJWT({ sub: randomUUID(), role: 'authenticated', exp: now() - 60 })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(new TextEncoder().encode(HS256_SECRET));
      expectUnauthorized(await get(hsApp, `Bearer ${expired}`));
    } finally {
      await hsApp.close();
    }

    // Invalid signature: ES256 token from a key that is not in the stack's JWKS.
    const foreign = await generateKeyPair('ES256');
    const forged = await new SignJWT({ sub: randomUUID(), role: 'authenticated', exp: now() + 600 })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(foreign.privateKey);
    expectUnauthorized(await get(jwksApp, `Bearer ${forged}`));
  });

  it('returns 200 with request.user.id equal to the subject of a real token', async () => {
    const user = await createTestUser();
    const res = await get(jwksApp, `Bearer ${user.token}`);
    expect(res.statusCode).toBe(200);
    // request.withUser runs the query under the same identity.
    expect(res.json()).toEqual({ userId: user.id, dbUid: user.id });
  });
});

const whoami = (app: FastifyInstance, authorization?: string) =>
  app.inject({
    method: 'GET',
    url: '/test/whoami',
    headers: authorization === undefined ? {} : { authorization },
  });

/** AUTH-06: the hook itself rejects, even when the route handler never asks for the user. */
describe('auth hook on a route that does not call withUser', () => {
  it.each([
    ['no Authorization header', undefined],
    ['a non-Bearer scheme', 'Basic dXNlcjpwYXNz'],
    ['a malformed Bearer token', 'Bearer not-a-jwt'],
    ['an empty Bearer token', 'Bearer '],
  ])('returns 401 with %s', async (_label, header) => {
    expectUnauthorized(await whoami(jwksApp, header));
  });

  it('returns 401 with an expired token', async () => {
    const hsApp = await appWithSampleRoute(config({ jwtSecret: HS256_SECRET }));
    try {
      const expired = await new SignJWT({ sub: randomUUID(), role: 'authenticated', exp: now() - 60 })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(new TextEncoder().encode(HS256_SECRET));
      expectUnauthorized(await whoami(hsApp, `Bearer ${expired}`));
    } finally {
      await hsApp.close();
    }
  });

  it('returns 401 with a forged ES256 signature', async () => {
    const foreign = await generateKeyPair('ES256');
    const forged = await new SignJWT({ sub: randomUUID(), role: 'authenticated', exp: now() + 600 })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(foreign.privateKey);
    expectUnauthorized(await whoami(jwksApp, `Bearer ${forged}`));
  });

  it('returns 200 with the token subject for a real token', async () => {
    const user = await createTestUser();
    const res = await whoami(jwksApp, `Bearer ${user.token}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ userId: user.id });
  });
});

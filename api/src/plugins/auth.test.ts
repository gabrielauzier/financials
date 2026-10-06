import { randomUUID } from 'node:crypto';
import {
  SignJWT,
  UnsecuredJWT,
  createLocalJWKSet,
  errors,
  exportJWK,
  generateKeyPair,
  type JWK,
  type JWTPayload,
} from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTokenVerifier, type VerifyToken } from './auth.js';
import { AppError } from './errors.js';

const SECRET = 'unit-test-secret-with-at-least-32-characters';
const OTHER_SECRET = 'another-unit-test-secret-of-32-characters';
const now = () => Math.floor(Date.now() / 1000);

function hs256(payload: JWTPayload, secret = SECRET, kid?: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', ...(kid ? { kid } : {}) })
    .sign(new TextEncoder().encode(secret));
}

async function expectUnauthorized(verify: VerifyToken, token: string): Promise<void> {
  const error = await verify(token).then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code: 'unauthorized', status: 401 });
}

describe('verifyToken, HS256 secret mode', () => {
  const verify = createTokenVerifier({ mode: 'hs256', secret: SECRET });

  it('returns the claims of a valid token', async () => {
    const sub = randomUUID();
    const token = await hs256({ sub, role: 'authenticated', exp: now() + 60 });
    await expect(verify(token)).resolves.toMatchObject({ sub, role: 'authenticated' });
  });

  it('rejects an expired token', async () => {
    const token = await hs256({ sub: randomUUID(), exp: now() - 60 });
    await expectUnauthorized(verify, token);
  });

  it('rejects a token without exp (it would never expire)', async () => {
    const token = await hs256({ sub: randomUUID() });
    await expectUnauthorized(verify, token);
  });

  it('rejects a token with a bad signature', async () => {
    const token = await hs256({ sub: randomUUID(), exp: now() + 60 }, OTHER_SECRET);
    await expectUnauthorized(verify, token);
  });

  it('rejects a token without sub', async () => {
    const token = await hs256({ role: 'authenticated', exp: now() + 60 });
    await expectUnauthorized(verify, token);
  });

  it.each([
    ['an empty sub', ''],
    ['a non-string sub', 123],
  ])('rejects a token with %s', async (_label, sub) => {
    await expectUnauthorized(verify, await hs256({ sub: sub as string, exp: now() + 60 }));
  });

  it.each([
    ['a malformed token', () => Promise.resolve('not-a-jwt')],
    ['an unsigned alg=none token', () =>
      Promise.resolve(new UnsecuredJWT({ sub: randomUUID(), exp: now() + 60 }).encode())],
  ])('rejects %s', async (_label, make) => {
    await expectUnauthorized(verify, await make());
  });
});

describe('verifyToken, JWKS mode', () => {
  const kid = 'local-test-key';
  let verify: VerifyToken;
  let sign: (payload: JWTPayload) => Promise<string>;
  let signWithForeignKey: (payload: JWTPayload) => Promise<string>;

  beforeAll(async () => {
    const own = await generateKeyPair('ES256');
    const foreign = await generateKeyPair('ES256');
    const publicJwk: JWK = { ...(await exportJWK(own.publicKey)), kid, alg: 'ES256', use: 'sig' };
    verify = createTokenVerifier({ mode: 'jwks', getKey: createLocalJWKSet({ keys: [publicJwk] }) });
    sign = (payload) => new SignJWT(payload).setProtectedHeader({ alg: 'ES256', kid }).sign(own.privateKey);
    signWithForeignKey = (payload) =>
      new SignJWT(payload).setProtectedHeader({ alg: 'ES256', kid }).sign(foreign.privateKey);
  });

  it('accepts a token signed by the locally generated key set', async () => {
    const sub = randomUUID();
    const token = await sign({ sub, role: 'authenticated', exp: now() + 60 });
    await expect(verify(token)).resolves.toMatchObject({ sub, role: 'authenticated' });
  });

  it('rejects an expired token', async () => {
    await expectUnauthorized(verify, await sign({ sub: randomUUID(), exp: now() - 60 }));
  });

  it('rejects a token signed by a key outside the set', async () => {
    await expectUnauthorized(verify, await signWithForeignKey({ sub: randomUUID(), exp: now() + 60 }));
  });

  it('rejects a token without sub', async () => {
    await expectUnauthorized(verify, await sign({ role: 'authenticated', exp: now() + 60 }));
  });

  it.each([
    ['an empty sub', ''],
    ['a non-string sub', 123],
  ])('rejects a token with %s', async (_label, sub) => {
    await expectUnauthorized(verify, await sign({ sub: sub as string, exp: now() + 60 }));
  });

  it('rejects an HS256 token (algorithm confusion), even with a matching kid', async () => {
    await expectUnauthorized(verify, await hs256({ sub: randomUUID(), exp: now() + 60 }, SECRET, kid));
  });

  it('rejects an unsigned alg=none token', async () => {
    await expectUnauthorized(verify, new UnsecuredJWT({ sub: randomUUID(), exp: now() + 60 }).encode());
  });

  it('rejects a malformed token', async () => {
    await expectUnauthorized(verify, 'a.b.c');
  });
});

describe('verifyToken, JWKS endpoint unavailable', () => {
  // The design does not define this case. Observed behaviour: it is NOT a 401 for the user;
  // the original error propagates (the error plugin turns it into a 500 without details).
  const failures: [string, Error][] = [
    ['a JWKS timeout', new errors.JWKSTimeout()],
    ['a network failure', new TypeError('fetch failed')],
  ];

  it.each(failures)('propagates %s instead of answering 401', async (_label, failure) => {
    const verify = createTokenVerifier({
      mode: 'jwks',
      getKey: () => Promise.reject(failure),
    });
    const own = await generateKeyPair('ES256');
    const token = await new SignJWT({ sub: randomUUID(), exp: now() + 60 })
      .setProtectedHeader({ alg: 'ES256', kid: 'any' })
      .sign(own.privateKey);

    const error = await verify(token).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(error).toBe(failure);
    expect(error).not.toBeInstanceOf(AppError);
  });
});

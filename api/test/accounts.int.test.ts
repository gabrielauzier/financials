import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { getLocalStack } from './helpers/stack.js';

let app: FastifyInstance;
let user: TestUser;

beforeAll(async () => {
  const { apiUrl, dbUrl } = getLocalStack();
  app = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl });
  await app.ready();
  user = await createTestUser();
});

afterAll(async () => {
  await app.close();
  await cleanupTestUsers();
  await closeAdminSql();
});

function call(as: TestUser, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${as.token}` }, payload: payload as object });
}

const valid = (nickname: string) => ({ bank: 'Nubank', nickname, holderNames: ['Maria Silva'] });

describe('POST /accounts', () => {
  it('creates an active account with trimmed holders and persists it', async () => {
    const res = await call(user, 'POST', '/accounts', {
      bank: 'SofisaDireto',
      nickname: '  Sofisa Pessoal ',
      holderNames: ['  Maria Silva ', 'Maria Silva LTDA'],
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      bank: 'SofisaDireto',
      nickname: 'Sofisa Pessoal',
      holderNames: ['Maria Silva', 'Maria Silva LTDA'],
      active: true,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    const rows = await getAdminSql()`
      select user_id, active, holder_names from public.accounts where id = ${res.json<{ id: string }>().id}`;
    expect(rows).toEqual([{ user_id: user.id, active: true, holder_names: ['Maria Silva', 'Maria Silva LTDA'] }]);
  });

  it('returns 409 duplicate_name for the same nickname in any case, but allows it for another user', async () => {
    expect((await call(user, 'POST', '/accounts', valid('Dup Conta'))).statusCode).toBe(201);
    const res = await call(user, 'POST', '/accounts', valid('  dUP conta '));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: { code: 'duplicate_name', message: expect.any(String), field: 'nickname' } });

    const other = await createTestUser();
    expect((await call(other, 'POST', '/accounts', valid('Dup Conta'))).statusCode).toBe(201);
  });

  it('returns 422 holder_required when there is no holder (empty list or only blanks)', async () => {
    for (const holderNames of [[], ['   ']]) {
      const res = await call(user, 'POST', '/accounts', { bank: 'XP', nickname: 'Sem titular', holderNames });
      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({ error: { code: 'holder_required', message: expect.any(String), field: 'holderNames' } });
    }
  });

  it('returns 422 for a blank nickname and for a duplicate holder in the same account', async () => {
    const blank = await call(user, 'POST', '/accounts', valid('   '));
    expect(blank.statusCode).toBe(422);
    expect(blank.json()).toMatchObject({ error: { field: 'nickname' } });

    const repeated = await call(user, 'POST', '/accounts', {
      bank: 'Neon',
      nickname: 'Titular repetido',
      holderNames: ['João Silva', ' joao   SILVA '],
    });
    expect(repeated.statusCode).toBe(422);
    expect(repeated.json()).toMatchObject({ error: { field: 'holderNames' } });

    const withBlank = await call(user, 'POST', '/accounts', {
      bank: 'Neon',
      nickname: 'Titular vazio',
      holderNames: ['João', ' '],
    });
    expect(withBlank.statusCode).toBe(422);
  });

  it('returns 422 for an invalid bank value', async () => {
    const res = await call(user, 'POST', '/accounts', { bank: 'Itau', nickname: 'Banco ruim', holderNames: ['A'] });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: { field: 'bank' } });
  });

  it('returns 400 validation_error for a malformed body and 401 without a token', async () => {
    const res = await call(user, 'POST', '/accounts', { bank: 'Nubank' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'validation_error' } });
    expect((await app.inject({ method: 'POST', url: '/accounts', payload: valid('x') })).statusCode).toBe(401);
  });
});

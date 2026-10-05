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

async function createAccount(as: TestUser, nickname: string): Promise<{ id: string; nickname: string }> {
  const res = await call(as, 'POST', '/accounts', valid(nickname));
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe('GET /accounts', () => {
  it("lists all of the user's accounts and none of another user's", async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const first = await createAccount(a, 'A primeira');
    const second = await createAccount(a, 'A segunda');
    const foreign = await createAccount(b, 'Da B');

    const res = await call(a, 'GET', '/accounts');
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; nickname: string; holderNames: string[]; active: boolean }[]>();
    expect(body.map((x) => x.id)).toEqual([first.id, second.id]);
    expect(body.map((x) => x.id)).not.toContain(foreign.id);
    expect(body[0]).toEqual({
      id: first.id,
      bank: 'Nubank',
      nickname: 'A primeira',
      holderNames: ['Maria Silva'],
      active: true,
      createdAt: expect.any(String),
    });
    expect(
      (await call(b, 'GET', '/accounts')).json<{ id: string }[]>().map((x) => x.id),
    ).toEqual([foreign.id]);
  });

  it('filters by active: active=true omits inactive accounts, active=false only lists them, no filter lists all', async () => {
    const owner = await createTestUser();
    const kept = await createAccount(owner, 'Ativa');
    const off = await createAccount(owner, 'Inativa');
    // The deactivate endpoint arrives in a later task; flip the flag by SQL for this test.
    await getAdminSql()`update public.accounts set active = false where id = ${off.id}`;

    const ids = async (query: string) =>
      (await call(owner, 'GET', `/accounts${query}`)).json<{ id: string }[]>().map((x) => x.id);
    expect(await ids('?active=true')).toEqual([kept.id]);
    expect(await ids('?active=false')).toEqual([off.id]);
    expect(await ids('')).toEqual([kept.id, off.id]);
    expect((await call(owner, 'GET', '/accounts?active=maybe')).statusCode).toBe(400);
  });
});

describe('PATCH /accounts/:id', () => {
  it('persists edits and leaves unspecified fields unchanged', async () => {
    const owner = await createTestUser();
    const acc = await createAccount(owner, 'Editável');

    const res = await call(owner, 'PATCH', `/accounts/${acc.id}`, { nickname: ' Renomeada ', holderNames: [' Ana ', 'Bia'] });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: acc.id,
      bank: 'Nubank',
      nickname: 'Renomeada',
      holderNames: ['Ana', 'Bia'],
      active: true,
      createdAt: expect.any(String),
    });

    const bankOnly = await call(owner, 'PATCH', `/accounts/${acc.id}`, { bank: 'XP' });
    expect(bankOnly.json()).toMatchObject({ bank: 'XP', nickname: 'Renomeada', holderNames: ['Ana', 'Bia'] });

    const listed = (await call(owner, 'GET', '/accounts')).json<{ id: string; bank: string; nickname: string }[]>();
    expect(listed).toEqual([expect.objectContaining({ id: acc.id, bank: 'XP', nickname: 'Renomeada' })]);

    const empty = await call(owner, 'PATCH', `/accounts/${acc.id}`, {});
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toMatchObject({ bank: 'XP', nickname: 'Renomeada' });
  });

  it('applies the same validations as create', async () => {
    const owner = await createTestUser();
    const acc = await createAccount(owner, 'Validada');
    await createAccount(owner, 'Outra conta');
    const patch = (body: unknown) => call(owner, 'PATCH', `/accounts/${acc.id}`, body);

    const dup = await patch({ nickname: 'OUTRA CONTA' });
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toMatchObject({ error: { code: 'duplicate_name' } });
    expect((await patch({ nickname: 'Validada' })).statusCode).toBe(200); // own nickname is not a duplicate
    expect((await patch({ holderNames: [] })).json()).toMatchObject({ error: { code: 'holder_required' } });
    expect((await patch({ holderNames: [] })).statusCode).toBe(422);
    expect((await patch({ nickname: '  ' })).statusCode).toBe(422);
    expect((await patch({ holderNames: ['Zé', 'ze'] })).statusCode).toBe(422);
    expect((await patch({ bank: 'Itau' })).statusCode).toBe(422);
    expect((await patch({ nickname: { not: "a string" } })).statusCode).toBe(400);

    // Rejected edits changed nothing.
    const [row] = (await call(owner, 'GET', '/accounts')).json<{ id: string; nickname: string; holderNames: string[] }[]>();
    expect(row).toMatchObject({ nickname: 'Validada', holderNames: ['Maria Silva'] });
  });

  it("returns 404 for an unknown id and for another user's id, leaving the account untouched", async () => {
    const owner = await createTestUser();
    const intruder = await createTestUser();
    const acc = await createAccount(owner, 'Alheia');

    const unknown = await call(owner, 'PATCH', '/accounts/00000000-0000-4000-8000-000000000000', { nickname: 'X' });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json()).toMatchObject({ error: { code: 'not_found' } });
    expect((await call(owner, 'PATCH', '/accounts/not-a-uuid', { nickname: 'X' })).statusCode).toBe(404);

    const foreign = await call(intruder, 'PATCH', `/accounts/${acc.id}`, { nickname: 'Hacked' });
    expect(foreign.statusCode).toBe(404);
    const rows = await getAdminSql()`select nickname from public.accounts where id = ${acc.id}`;
    expect(rows).toEqual([{ nickname: 'Alheia' }]);
  });
});

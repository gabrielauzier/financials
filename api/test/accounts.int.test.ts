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
      color: 'slate-600',
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
      color: 'slate-600',
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
      color: 'slate-600',
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

describe('POST /accounts/:id/deactivate and /activate', () => {
  it('deactivate sets active=false and keeps the row; activate restores active=true', async () => {
    const owner = await createTestUser();
    const acc = await createAccount(owner, 'Alternável');

    const off = await call(owner, 'POST', `/accounts/${acc.id}/deactivate`);
    expect(off.statusCode).toBe(200);
    expect(off.json()).toMatchObject({ id: acc.id, active: false, nickname: 'Alternável' });
    const kept = await getAdminSql()`select active from public.accounts where id = ${acc.id}`;
    expect(kept).toEqual([{ active: false }]);

    const on = await call(owner, 'POST', `/accounts/${acc.id}/activate`);
    expect(on.statusCode).toBe(200);
    expect(on.json()).toMatchObject({ id: acc.id, active: true });
    expect(await getAdminSql()`select active from public.accounts where id = ${acc.id}`).toEqual([{ active: true }]);
  });

  it('answers 404 to DELETE /accounts/:id (no route) and keeps the account', async () => {
    const owner = await createTestUser();
    const acc = await createAccount(owner, 'Indeletável');
    const res = await call(owner, 'DELETE', `/accounts/${acc.id}`);
    expect(res.statusCode).toBe(404);
    expect(await getAdminSql()`select id from public.accounts where id = ${acc.id}`).toHaveLength(1);
  });

  it('keeps the holder names of an inactive account readable, in the list and when filtering inactive', async () => {
    const owner = await createTestUser();
    const created = await call(owner, 'POST', '/accounts', {
      bank: 'Neon',
      nickname: 'Parada',
      holderNames: ['Maria Silva', 'Maria Silva LTDA'],
    });
    const { id } = created.json<{ id: string }>();
    await call(owner, 'POST', `/accounts/${id}/deactivate`);

    const all = (await call(owner, 'GET', '/accounts')).json<{ id: string; active: boolean; holderNames: string[] }[]>();
    expect(all).toEqual([expect.objectContaining({ id, active: false, holderNames: ['Maria Silva', 'Maria Silva LTDA'] })]);
    const inactive = (await call(owner, 'GET', '/accounts?active=false')).json<{ holderNames: string[] }[]>();
    expect(inactive[0]?.holderNames).toEqual(['Maria Silva', 'Maria Silva LTDA']);
    expect((await call(owner, 'GET', '/accounts?active=true')).json()).toEqual([]);
  });

  it("returns 404 for an unknown id and for another user's id without changing the account", async () => {
    const owner = await createTestUser();
    const intruder = await createTestUser();
    const acc = await createAccount(owner, 'Protegida');

    for (const action of ['deactivate', 'activate']) {
      const unknown = await call(owner, 'POST', `/accounts/00000000-0000-4000-8000-000000000000/${action}`);
      expect(unknown.statusCode).toBe(404);
      expect((await call(intruder, 'POST', `/accounts/${acc.id}/${action}`)).statusCode).toBe(404);
    }
    expect(await getAdminSql()`select active from public.accounts where id = ${acc.id}`).toEqual([{ active: true }]);
  });
});

const INVALID_STRING_COLORS = ['', 'blue', 'blue-500', 'Blue-600', ' blue-600', '#2563eb'];
const WRONG_TYPE_COLORS: unknown[] = [null, 5, { key: 'blue-600' }];

describe('account color', () => {
  it('creates with a chosen color and stores it', async () => {
    const res = await call(user, 'POST', '/accounts', { ...valid('Cor escolhida'), color: 'teal-400' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ color: 'teal-400' });
    const rows = await getAdminSql()`select color from public.accounts where id = ${res.json<{ id: string }>().id}`;
    expect(rows).toEqual([{ color: 'teal-400' }]);
  });

  it('stores and returns slate-600 when the color is omitted', async () => {
    const res = await call(user, 'POST', '/accounts', valid('Cor padrão'));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ color: 'slate-600' });
    const rows = await getAdminSql()`select color from public.accounts where id = ${res.json<{ id: string }>().id}`;
    expect(rows).toEqual([{ color: 'slate-600' }]);
  });

  it.each(INVALID_STRING_COLORS)('POST rejects the color %j with 422 on field color and writes nothing', async (color) => {
    const nickname = `Post inválida ${JSON.stringify(color)}`;
    const res = await call(user, 'POST', '/accounts', { ...valid(nickname), color });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { code: 'validation_error', message: expect.any(String), field: 'color' } });
    expect(await getAdminSql()`select 1 from public.accounts where nickname = ${nickname}`).toHaveLength(0);
  });

  it('PATCH rejects every invalid string color with 422 on field color and keeps the stored color', async () => {
    const owner = await createTestUser();
    const acc = (await call(owner, 'POST', '/accounts', { ...valid('Patch inválida'), color: 'blue-400' })).json<{ id: string }>();
    for (const color of INVALID_STRING_COLORS) {
      const res = await call(owner, 'PATCH', `/accounts/${acc.id}`, { color });
      expect({ color, status: res.statusCode }).toEqual({ color, status: 422 });
      expect(res.json()).toEqual({ error: { code: 'validation_error', message: expect.any(String), field: 'color' } });
    }
    expect(await getAdminSql()`select color from public.accounts where id = ${acc.id}`).toEqual([{ color: 'blue-400' }]);
  });

  it('answers 400 validation_error for a color that is not a string, on POST and PATCH', async () => {
    const owner = await createTestUser();
    const acc = (await call(owner, 'POST', '/accounts', valid('Tipo errado'))).json<{ id: string }>();
    for (const color of WRONG_TYPE_COLORS) {
      const post = await call(owner, 'POST', '/accounts', { ...valid(`Tipo ${JSON.stringify(color)}`), color });
      expect({ color, status: post.statusCode }).toEqual({ color, status: 400 });
      expect(post.json()).toMatchObject({ error: { code: 'validation_error', field: 'color' } });
      const patch = await call(owner, 'PATCH', `/accounts/${acc.id}`, { color });
      expect({ color, status: patch.statusCode }).toEqual({ color, status: 400 });
      expect(patch.json()).toMatchObject({ error: { code: 'validation_error', field: 'color' } });
    }
    expect(await getAdminSql()`select count(*)::int as n from public.accounts where user_id = ${owner.id}`).toEqual([{ n: 1 }]);
    expect(await getAdminSql()`select color from public.accounts where id = ${acc.id}`).toEqual([{ color: 'slate-600' }]);
  });

  it('PATCH with only color changes it and keeps bank, nickname and holders', async () => {
    const owner = await createTestUser();
    const created = (
      await call(owner, 'POST', '/accounts', {
        bank: 'Neon',
        nickname: 'Só cor',
        holderNames: ['Ana', 'Beto'],
      })
    ).json<{ id: string }>();
    const res = await call(owner, 'PATCH', `/accounts/${created.id}`, { color: 'rose-900' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ color: 'rose-900', bank: 'Neon', nickname: 'Só cor', holderNames: ['Ana', 'Beto'] });
    expect(
      await getAdminSql()`select color, bank, nickname, holder_names from public.accounts where id = ${created.id}`,
    ).toEqual([{ color: 'rose-900', bank: 'Neon', nickname: 'Só cor', holder_names: ['Ana', 'Beto'] }]);
  });

  it('PATCH with a color and an invalid nickname changes nothing', async () => {
    const owner = await createTestUser();
    const created = (await call(owner, 'POST', '/accounts', { ...valid('Atômica'), color: 'blue-400' })).json<{ id: string }>();
    const res = await call(owner, 'PATCH', `/accounts/${created.id}`, { color: 'red-900', nickname: '   ' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: { field: 'nickname' } });
    expect(await getAdminSql()`select color, nickname from public.accounts where id = ${created.id}`).toEqual([
      { color: 'blue-400', nickname: 'Atômica' },
    ]);
  });

  it('returns color in the list, activate and deactivate responses', async () => {
    const owner = await createTestUser();
    const created = (await call(owner, 'POST', '/accounts', { ...valid('Status'), color: 'lime-600' })).json<{ id: string }>();
    const listed = (await call(owner, 'GET', '/accounts')).json<{ id: string; color: string }[]>();
    expect(listed).toEqual([expect.objectContaining({ id: created.id, color: 'lime-600' })]);
    const off = await call(owner, 'POST', `/accounts/${created.id}/deactivate`);
    expect(off.json()).toMatchObject({ active: false, color: 'lime-600' });
    const on = await call(owner, 'POST', `/accounts/${created.id}/activate`);
    expect(on.json()).toMatchObject({ active: true, color: 'lime-600' });
  });

  it("answers 404 when another user patches the account's color and leaves it unchanged", async () => {
    const owner = await createTestUser();
    const intruder = await createTestUser();
    const created = (await call(owner, 'POST', '/accounts', { ...valid('Cor alheia'), color: 'teal-600' })).json<{ id: string }>();
    const res = await call(intruder, 'PATCH', `/accounts/${created.id}`, { color: 'red-400' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'not_found' } });
    expect(await getAdminSql()`select color from public.accounts where id = ${created.id}`).toEqual([{ color: 'teal-600' }]);
  });
});

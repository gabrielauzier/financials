import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { getLocalStack } from './helpers/stack.js';

let app: FastifyInstance;

beforeAll(async () => {
  const { apiUrl, dbUrl } = getLocalStack();
  app = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await cleanupTestUsers();
  await closeAdminSql();
});

function call(as: TestUser, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${as.token}` }, payload: payload as object });
}

interface Category {
  id: string;
  key: string | null;
  name: string;
  isSystem: boolean;
}

async function list(as: TestUser): Promise<Category[]> {
  const res = await call(as, 'GET', '/categories');
  expect(res.statusCode).toBe(200);
  return res.json<Category[]>();
}

// Spec CAT-01 keys and pt-BR names; the spec defines no order, the API sorts by name (case-insensitive).
const SEEDED_BY_NAME: [key: string, name: string, isSystem: boolean][] = [
  ['Help', 'Ajuda (a terceiros)', false],
  ['Food', 'Alimentação', false],
  ['Shopping', 'Compras', false],
  ['Bills', 'Contas', false],
  ['Unknown', 'Desconhecida', false],
  ['Wishes', 'Desejos', false],
  ['Emergency', 'Emergência', false],
  ['Entertainment', 'Entretenimento', false],
  ['Reversal', 'Estorno (de compras)', true],
  ['Investments', 'Investimentos', true],
  ['Pets', 'Pets', false],
  ['PJ', 'PJ', false],
  ['Salaries', 'Salários', false],
  ['Healthcare', 'Saúde', false],
  ['Uncategorized', 'Sem categoria', true],
  ['Transport', 'Transporte', false],
  ['Utilities', 'Utilidades', false],
];

describe('GET /categories', () => {
  it('returns the 17 seeded categories of a new user with pt-BR names, sorted by name', async () => {
    const user = await createTestUser();
    const body = await list(user);

    expect(body).toHaveLength(17);
    expect(body.map((c) => [c.key, c.name, c.isSystem])).toEqual(SEEDED_BY_NAME);
    for (const category of body) {
      expect(category).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        key: expect.any(String),
        name: expect.any(String),
        isSystem: expect.any(Boolean),
      });
    }
  });

  it("never returns another user's categories", async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const idsA = (await list(a)).map((c) => c.id);
    const idsB = (await list(b)).map((c) => c.id);

    expect(idsA).toHaveLength(17);
    expect(idsB).toHaveLength(17);
    expect(idsA.filter((id) => idsB.includes(id))).toEqual([]);
  });
});

describe('POST /categories', () => {
  it('creates a trimmed, non-system category with no key, ignoring client-sent key and isSystem', async () => {
    const user = await createTestUser();
    const res = await call(user, 'POST', '/categories', { name: '  Mercado  ', key: 'Reversal', isSystem: true });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      key: null,
      name: 'Mercado',
      isSystem: false,
    });

    const rows = await getAdminSql()`
      select user_id, key, name, is_system from public.categories where id = ${res.json<Category>().id}`;
    expect(rows).toEqual([{ user_id: user.id, key: null, name: 'Mercado', is_system: false }]);
    expect((await list(user)).map((c) => c.name)).toContain('Mercado');
  });

  it('returns 422 validation_error on name for a blank or whitespace-only name, creating nothing', async () => {
    const user = await createTestUser();
    for (const name of ['', '   ']) {
      const res = await call(user, 'POST', '/categories', { name });
      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({ error: { code: 'validation_error', message: expect.any(String), field: 'name' } });
    }
    expect(await list(user)).toHaveLength(17);
  });

  it('returns 409 duplicate_name on name for an existing name in any case, but allows it for another user', async () => {
    const user = await createTestUser();
    expect((await call(user, 'POST', '/categories', { name: 'Viagem' })).statusCode).toBe(201);
    for (const name of ['VIAGEM', '  viagem ', 'ALIMENTAÇÃO']) {
      const res = await call(user, 'POST', '/categories', { name });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: { code: 'duplicate_name', message: expect.any(String), field: 'name' } });
    }
    expect(await list(user)).toHaveLength(18);

    const other = await createTestUser();
    expect((await call(other, 'POST', '/categories', { name: 'Viagem' })).statusCode).toBe(201);
  });
});

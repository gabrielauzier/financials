import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, type TestUser } from './helpers/db.js';
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

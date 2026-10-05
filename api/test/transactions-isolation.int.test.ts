import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { getLocalStack } from './helpers/stack.js';

let app: FastifyInstance;
let a: TestUser;
let b: TestUser;
let accountA: string;
let accountB: string;

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

function call(as: TestUser, method: Method, url: string, payload?: unknown) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${as.token}` }, payload: payload as object });
}

async function createAccount(as: TestUser, nickname: string): Promise<string> {
  const res = await call(as, 'POST', '/accounts', { bank: 'Nubank', nickname, holderNames: ['Ana'] });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

async function categoryId(as: TestUser, key: string): Promise<string> {
  const [row] = await getAdminSql()`select id from public.categories where user_id = ${as.id} and key = ${key}`;
  return (row as { id: string }).id;
}

const body = (accountId: string, over: Record<string, unknown> = {}) => ({
  name: 'Mercado',
  type: 'Expense',
  occurredAt: '2026-10-05T14:30:00-03:00',
  amount: '50.00',
  accountId,
  paymentMethod: 'PIX',
  ...over,
});

async function create(as: TestUser, accountId: string, name: string): Promise<{ id: string }> {
  const res = await call(as, 'POST', '/transactions', body(accountId, { name }));
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>();
}

interface Page {
  items: { id: string }[];
  total: number;
}

async function list(as: TestUser, query = ''): Promise<Page> {
  const res = await call(as, 'GET', `/transactions${query}`);
  expect(res.statusCode).toBe(200);
  return res.json<Page>();
}

/** A's rows straight from the database, bypassing the API and RLS. */
async function adminRowsOf(user: TestUser) {
  return getAdminSql()`
    select id, account_id, category_id, name, type, occurred_at, amount::text as amount, payment_method,
           notes, receipt, neutral
    from public.transactions where user_id = ${user.id} order by id`;
}

beforeAll(async () => {
  const { apiUrl, dbUrl } = getLocalStack();
  app = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl });
  await app.ready();
  a = await createTestUser();
  b = await createTestUser();
  accountA = await createAccount(a, 'Conta da A');
  accountB = await createAccount(b, 'Conta do B');
});

afterAll(async () => {
  await app.close();
  await cleanupTestUsers();
  await closeAdminSql();
});

describe("isolation between users' transactions (AUTH-08)", () => {
  it("answers 404 to every mutation user B attempts on user A's rows, changing nothing", async () => {
    const rowA = await create(a, accountA, 'Da A');
    const otherRowA = await create(a, accountA, 'Outra da A');
    const rowB = await create(b, accountB, 'Do B');
    const listedBefore = (await call(a, 'GET', '/transactions')).json();
    const storedBefore = await adminRowsOf(a);
    const foodB = await categoryId(b, 'Food');

    const attempts: [method: Method, url: string, payload?: unknown][] = [
      ['PATCH', `/transactions/${rowA.id}`, { name: 'Invadido', amount: '1.00', neutral: true }],
      ['PATCH', `/transactions/${rowA.id}`, {}],
      ['DELETE', `/transactions/${rowA.id}`],
      ['PATCH', '/transactions/category', { ids: [rowA.id], categoryId: foodB }],
      // Mixed with B's own row: still 404 and B's row is not changed either (all or nothing).
      ['PATCH', '/transactions/category', { ids: [rowB.id, rowA.id, otherRowA.id], categoryId: foodB }],
    ];
    for (const [method, url, payload] of attempts) {
      const res = await call(b, method, url, payload);
      expect({ method, url, status: res.statusCode }).toEqual({ method, url, status: 404 });
      expect(res.json()).toMatchObject({ error: { code: 'not_found' } });
    }

    expect((await call(a, 'GET', '/transactions')).json()).toEqual(listedBefore);
    expect(await adminRowsOf(a)).toEqual(storedBefore);
    expect((await getAdminSql()`select category_id from public.transactions where id = ${rowB.id}`)[0]).toEqual({
      category_id: await categoryId(b, 'Uncategorized'),
    });
  });

  it("never lists or counts user A's rows for user B, with or without filters", async () => {
    const rowA = await create(a, accountA, 'Exclusiva da A');
    const mine = await list(b);
    expect(mine.items.map((r) => r.id)).not.toContain(rowA.id);
    expect(mine.total).toBe((await adminRowsOf(b)).length);

    // Filtering by A's account or category, or searching A's row name, finds nothing for B.
    for (const query of [
      `?accountId=${accountA}`,
      `?categoryId=${await categoryId(a, 'Uncategorized')}`,
      `?q=${encodeURIComponent('Exclusiva da A')}`,
    ]) {
      expect(await list(b, query), query).toEqual({ items: [], total: 0, page: 1, pageSize: 50 });
    }
    expect((await list(a, `?q=${encodeURIComponent('Exclusiva da A')}`)).items.map((r) => r.id)).toEqual([rowA.id]);
  });

  it("does not let user B attach user A's account or category to B's transactions", async () => {
    const foodA = await categoryId(a, 'Food');
    const rowB = await create(b, accountB, 'Alvo do B');
    const storedB = await adminRowsOf(b);

    const createWithAccount = await call(b, 'POST', '/transactions', body(accountA));
    expect(createWithAccount.statusCode).toBe(422);
    expect(createWithAccount.json()).toMatchObject({ error: { code: 'invalid_account', field: 'accountId' } });
    const createWithCategory = await call(b, 'POST', '/transactions', body(accountB, { categoryId: foodA }));
    expect(createWithCategory.statusCode).toBe(404);
    expect(createWithCategory.json()).toMatchObject({ error: { code: 'not_found', field: 'categoryId' } });

    const patchAccount = await call(b, 'PATCH', `/transactions/${rowB.id}`, { accountId: accountA });
    expect(patchAccount.statusCode).toBe(422);
    expect(patchAccount.json()).toMatchObject({ error: { code: 'invalid_account', field: 'accountId' } });
    const patchCategory = await call(b, 'PATCH', `/transactions/${rowB.id}`, { categoryId: foodA });
    expect(patchCategory.statusCode).toBe(404);
    expect(patchCategory.json()).toMatchObject({ error: { code: 'not_found', field: 'categoryId' } });
    const bulkCategory = await call(b, 'PATCH', '/transactions/category', { ids: [rowB.id], categoryId: foodA });
    expect(bulkCategory.statusCode).toBe(404);
    expect(bulkCategory.json()).toMatchObject({ error: { code: 'not_found', field: 'categoryId' } });

    expect(await adminRowsOf(b)).toEqual(storedB);
  });

  // Lesson L-001: these routes have no guard of their own; the global auth hook must answer 401.
  it('answers 401 without a token on every transactions route, changing nothing', async () => {
    const rowA = await create(a, accountA, 'Sem token');
    const foodA = await categoryId(a, 'Food');
    const storedBefore = await adminRowsOf(a);

    const attempts: [method: Method, url: string, payload?: unknown][] = [
      ['POST', '/transactions', body(accountA)],
      ['GET', '/transactions'],
      ['PATCH', `/transactions/${rowA.id}`, { name: 'Sem dono' }],
      ['DELETE', `/transactions/${rowA.id}`],
      ['PATCH', '/transactions/category', { ids: [rowA.id], categoryId: foodA }],
    ];
    for (const [method, url, payload] of attempts) {
      const res = await app.inject({ method, url, payload: payload as object });
      expect({ method, url, status: res.statusCode }).toEqual({ method, url, status: 401 });
    }
    expect(await adminRowsOf(a)).toEqual(storedBefore);
  });
});

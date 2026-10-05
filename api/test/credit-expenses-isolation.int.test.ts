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
  name: 'Notebook',
  totalAmount: '600.00',
  paidAmount: '200.00',
  occurredAt: '2026-10-05T14:30:00-03:00',
  recurrencyDay: 10,
  status: 'Active',
  accountId,
  ...over,
});

async function create(as: TestUser, accountId: string, name: string): Promise<{ id: string }> {
  const res = await call(as, 'POST', '/credit-expenses', body(accountId, { name }));
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>();
}

async function list(as: TestUser): Promise<{ id: string }[]> {
  const res = await call(as, 'GET', '/credit-expenses');
  expect(res.statusCode).toBe(200);
  return res.json<{ id: string }[]>();
}

/** A user's rows straight from the database, bypassing the API and RLS. */
async function adminRowsOf(user: TestUser) {
  return getAdminSql()`
    select id, account_id, category_id, name, total_amount::text as total_amount,
           paid_amount::text as paid_amount, occurred_at, recurrency_day, status, notes
    from public.credit_expenses where user_id = ${user.id} order by id`;
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

describe("isolation between users' credit expenses (AUTH-08)", () => {
  it("answers 404 to every mutation user B attempts on user A's rows, changing nothing", async () => {
    const rowA = await create(a, accountA, 'Da A');
    await create(b, accountB, 'Do B');
    const listedBefore = await list(a);
    const storedBefore = await adminRowsOf(a);

    const attempts: [method: Method, url: string, payload?: unknown][] = [
      ['PATCH', `/credit-expenses/${rowA.id}`, { name: 'Invadido', totalAmount: '1.00', paidAmount: '0.00', status: 'Canceled' }],
      ['PATCH', `/credit-expenses/${rowA.id}`, {}],
      ['PATCH', `/credit-expenses/${rowA.id}`, { status: 'Inactive' }],
      ['DELETE', `/credit-expenses/${rowA.id}`],
    ];
    for (const [method, url, payload] of attempts) {
      const res = await call(b, method, url, payload);
      expect({ method, url, status: res.statusCode }).toEqual({ method, url, status: 404 });
      expect(res.json()).toMatchObject({ error: { code: 'not_found' } });
    }
    // Deleting again as the owner would still find it: B's attempts removed nothing.
    expect(await list(a)).toEqual(listedBefore);
    expect(await adminRowsOf(a)).toEqual(storedBefore);
  });

  it("never lists user A's rows for user B, and each user sees only their own", async () => {
    const rowA = await create(a, accountA, 'Exclusiva da A');
    const rowB = await create(b, accountB, 'Exclusiva do B');
    const seenByB = (await list(b)).map((r) => r.id);
    expect(seenByB).not.toContain(rowA.id);
    expect(seenByB).toContain(rowB.id);
    expect(seenByB.sort()).toEqual((await adminRowsOf(b)).map((r) => r.id as string).sort());
    // The status filter does not widen the scope either.
    for (const status of ['Once', 'Active', 'Inactive', 'Canceled', 'ToCancel']) {
      const res = await call(b, 'GET', `/credit-expenses?status=${status}`);
      expect(res.json<{ id: string }[]>().map((r) => r.id)).not.toContain(rowA.id);
    }
    expect((await list(a)).map((r) => r.id)).toContain(rowA.id);
    expect((await list(a)).map((r) => r.id)).not.toContain(rowB.id);
  });

  it("does not let user B attach user A's account or category on create or edit", async () => {
    const foodA = await categoryId(a, 'Food');
    const rowB = await create(b, accountB, 'Alvo do B');
    const storedB = await adminRowsOf(b);
    const storedA = await adminRowsOf(a);

    const createWithAccount = await call(b, 'POST', '/credit-expenses', body(accountA));
    expect(createWithAccount.statusCode).toBe(422);
    expect(createWithAccount.json()).toMatchObject({ error: { code: 'invalid_account', field: 'accountId' } });
    const createWithCategory = await call(b, 'POST', '/credit-expenses', body(accountB, { categoryId: foodA }));
    expect(createWithCategory.statusCode).toBe(404);
    expect(createWithCategory.json()).toMatchObject({ error: { code: 'not_found', field: 'categoryId' } });

    const patchAccount = await call(b, 'PATCH', `/credit-expenses/${rowB.id}`, { accountId: accountA });
    expect(patchAccount.statusCode).toBe(422);
    expect(patchAccount.json()).toMatchObject({ error: { code: 'invalid_account', field: 'accountId' } });
    const patchCategory = await call(b, 'PATCH', `/credit-expenses/${rowB.id}`, { categoryId: foodA });
    expect(patchCategory.statusCode).toBe(404);
    expect(patchCategory.json()).toMatchObject({ error: { code: 'not_found', field: 'categoryId' } });

    expect(await adminRowsOf(b)).toEqual(storedB);
    expect(await adminRowsOf(a)).toEqual(storedA);
  });

  // Lesson L-001: these routes have no guard of their own; the global auth hook must answer 401.
  it('answers 401 without a token and with a malformed token on every credit expenses route, changing nothing', async () => {
    const rowA = await create(a, accountA, 'Sem token');
    const storedBefore = await adminRowsOf(a);
    const listedBefore = await list(a);

    const attempts: [method: Method, url: string, payload?: unknown][] = [
      ['POST', '/credit-expenses', body(accountA)],
      ['GET', '/credit-expenses'],
      ['GET', '/credit-expenses?status=Active'],
      ['PATCH', `/credit-expenses/${rowA.id}`, { name: 'Sem dono' }],
      ['DELETE', `/credit-expenses/${rowA.id}`],
    ];
    const credentials: Record<string, string>[] = [{}, { authorization: 'Bearer not-a-jwt' }];
    for (const headers of credentials) {
      for (const [method, url, payload] of attempts) {
        const res = await app.inject({ method, url, headers, payload: payload as object });
        expect({ headers, method, url, status: res.statusCode }).toEqual({ headers, method, url, status: 401 });
      }
    }
    expect(await adminRowsOf(a)).toEqual(storedBefore);
    expect(await list(a)).toEqual(listedBefore);
  });
});

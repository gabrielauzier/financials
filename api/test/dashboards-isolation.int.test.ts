import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, closeAdminSql, createTestUser, type TestUser } from './helpers/db.js';
import { asUser, get, localInstant, seedAccount, seedReturns, seedTransactions, send, startApp, type ReturnJson } from './helpers/dashboards.js';

const SP = 'America/Sao_Paulo';
const ALL_TIME = '?from=2000-01-01&to=2099-12-31';

let app: FastifyInstance;
let a: TestUser;
let b: TestUser;
let accountA: string;
let accountB: string;
let returnA: ReturnJson;

beforeAll(async () => {
  app = await startApp();
  a = await createTestUser();
  b = await createTestUser();
  accountA = await seedAccount(a, 'Conta da A');
  accountB = await seedAccount(b, 'Conta do B');

  const yesterday = localInstant(1, SP);
  await seedTransactions(a, accountA, [
    { type: 'Income', amount: '1000.00', at: yesterday },
    { type: 'Expense', amount: '300.00', at: yesterday, category: 'Food' },
    { type: 'Expense', amount: '77.00', at: yesterday, category: 'Shopping', method: 'CreditCard' },
  ]);
  await asUser(a.id, (tx) => tx`
    insert into public.credit_expenses
      (account_id, category_id, name, total_amount, paid_amount, occurred_at, recurrency_day, status)
    values (${accountA}, (select id from public.categories where key = 'Entertainment'),
            'Streaming da A', 120, 20, '2026-01-05T12:00:00Z', 5, 'Active')`);
  await seedReturns(a, accountA, [{ on: '2026-01-10', amount: '50.00' }]);
  const res = await send(app, a, 'POST', '/investment-returns', { occurredOn: '2026-01-11', amount: '-20.00', accountId: accountA, notes: 'da A' });
  expect(res.statusCode).toBe(201);
  returnA = res.json<ReturnJson>();
});

afterAll(async () => {
  await app.close();
  await cleanupTestUsers();
  await closeAdminSql();
});

const json = async <T>(as: TestUser, url: string) => {
  const res = await get(app, as, url);
  expect(res.statusCode).toBe(200);
  return res.json<T>();
};

/** Every dashboard endpoint, read for the user with a window that covers all data. */
async function readAll(as: TestUser) {
  return {
    last30: await json<{ total: string; previousTotal: string }>(as, '/dashboard/last-30-days'),
    trend: await json<{ points: { income: string; expense: string; balance: string }[] }>(as, '/dashboard/trend'),
    categories: await json<{ items: unknown[] }>(as, `/dashboard/categories${ALL_TIME}`),
    netWorth: await json<{ current: string; series: unknown[] }>(as, '/dashboard/net-worth'),
    card: await json<{ transactions: unknown[]; creditExpenses: unknown[] }>(as, `/dashboard/card${ALL_TIME}`),
    returns: await json<{ items: ReturnJson[]; lastDate: string | null }>(as, '/investment-returns'),
  };
}

describe('dashboard isolation between users (AUTH-08)', () => {
  it('sanity: user A sees their own data on every endpoint', async () => {
    const r = await readAll(a);
    expect(r.last30.total).toBe('300.00');
    expect(r.trend.points.at(-1)?.income === '1000.00' || r.trend.points.at(-2)?.income === '1000.00').toBe(true);
    expect(r.categories.items).not.toEqual([]);
    expect(r.netWorth.current).toBe('730.00');
    expect(r.card.transactions).toEqual([{ categoryName: 'Compras', total: '77.00' }]);
    expect(r.card.creditExpenses).toEqual([{ categoryName: 'Entretenimento', remaining: '100.00' }]);
    expect(r.returns.items).toHaveLength(2);
  });

  it("user B without data sees empty and zero dashboards, never user A's data", async () => {
    const r = await readAll(b);
    expect(r.last30).toMatchObject({ total: '0.00', previousTotal: '0.00' });
    expect(r.trend.points).toHaveLength(12);
    for (const p of r.trend.points) expect(p).toMatchObject({ income: '0.00', expense: '0.00', balance: '0.00' });
    expect(r.categories.items).toEqual([]);
    expect(r.netWorth).toEqual({ current: '0.00', series: [] });
    expect(r.card).toEqual({ transactions: [], creditExpenses: [] });
    expect(r.returns).toEqual({ items: [], lastDate: null });
  });

  it("user B's dashboards count only B's rows when both users have data", async () => {
    const other = await createTestUser();
    const acc = await seedAccount(other, 'Do outro');
    await seedTransactions(other, acc, [
      { type: 'Income', amount: '10.00', at: localInstant(1, SP) },
      { type: 'Expense', amount: '4.00', at: localInstant(1, SP), category: 'Transport' },
    ]);
    await seedReturns(other, acc, [{ on: '2026-01-10', amount: '1.00' }]);
    const r = await readAll(other);
    expect(r.last30.total).toBe('4.00');
    expect(r.netWorth.current).toBe('7.00');
    expect(r.card).toEqual({ transactions: [], creditExpenses: [] });
    expect(r.returns.items).toHaveLength(1);
    // A's figures are unaffected by B's writes.
    expect((await readAll(a)).netWorth.current).toBe('730.00');
  });
});

describe("isolation of investment returns (AUTH-08, DASH-06.5)", () => {
  it("answers 404 to user B's PATCH and DELETE on user A's returns, changing nothing", async () => {
    const before = await json<{ items: ReturnJson[] }>(a, '/investment-returns');
    const attempts: [method: 'PATCH' | 'DELETE', payload?: unknown][] = [
      ['PATCH', { amount: '999.00', notes: 'invadido' }],
      ['PATCH', {}],
      ['PATCH', { accountId: accountB }],
      ['DELETE'],
    ];
    for (const [method, payload] of attempts) {
      const res = await send(app, b, method, `/investment-returns/${returnA.id}`, payload);
      expect({ method, status: res.statusCode }).toEqual({ method, status: 404 });
      expect(res.json()).toMatchObject({ error: { code: 'not_found' } });
    }
    expect(await json(a, '/investment-returns')).toEqual(before);
    expect((await json<{ current: string }>(a, '/dashboard/net-worth')).current).toBe('730.00');
  });

  it("never lists user A's returns for user B and keeps each list separate", async () => {
    const mine = await send(app, b, 'POST', '/investment-returns', { occurredOn: '2026-02-02', amount: '5.00', accountId: accountB });
    expect(mine.statusCode).toBe(201);
    const seenByB = (await json<{ items: ReturnJson[] }>(b, '/investment-returns')).items.map((r) => r.id);
    expect(seenByB).toEqual([mine.json<ReturnJson>().id]);
    const seenByA = (await json<{ items: ReturnJson[] }>(a, '/investment-returns')).items.map((r) => r.id);
    expect(seenByA).toContain(returnA.id);
    expect(seenByA).not.toContain(mine.json<ReturnJson>().id);
  });

  it("does not let user B create a return on user A's account, nor move one onto it", async () => {
    const create = await send(app, b, 'POST', '/investment-returns', { occurredOn: '2026-02-03', amount: '1.00', accountId: accountA });
    expect(create.statusCode).toBe(422);
    expect(create.json()).toMatchObject({ error: { code: 'invalid_account', field: 'accountId' } });

    const own = (await json<{ items: ReturnJson[] }>(b, '/investment-returns')).items[0] as ReturnJson;
    const move = await send(app, b, 'PATCH', `/investment-returns/${own.id}`, { accountId: accountA });
    expect(move.statusCode).toBe(422);
    expect(move.json()).toMatchObject({ error: { code: 'invalid_account' } });
    expect((await json<{ items: ReturnJson[] }>(b, '/investment-returns')).items[0]).toEqual(own);
    expect((await json<{ items: ReturnJson[] }>(a, '/investment-returns')).items).toHaveLength(2);
  });
});

describe('authentication on the new and dashboard routes (AUTH)', () => {
  const ID = '00000000-0000-4000-8000-000000000000';
  const routes: [method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string][] = [
    ['GET', '/investment-returns'],
    ['POST', '/investment-returns'],
    ['PATCH', `/investment-returns/${ID}`],
    ['DELETE', `/investment-returns/${ID}`],
    ['GET', '/dashboard/last-30-days'],
    ['GET', '/dashboard/trend'],
    ['GET', '/dashboard/categories'],
    ['GET', '/dashboard/net-worth'],
    ['GET', '/dashboard/card'],
  ];

  it.each(routes)('%s %s answers 401 without a token', async (method, url) => {
    const res = await app.inject({ method, url, payload: method === 'POST' || method === 'PATCH' ? {} : undefined });
    expect(res.statusCode).toBe(401);
  });

  it.each(routes)('%s %s answers 401 with an invalid token', async (method, url) => {
    const res = await app.inject({
      method,
      url,
      headers: { authorization: 'Bearer not.a.token' },
      payload: method === 'POST' || method === 'PATCH' ? {} : undefined,
    });
    expect(res.statusCode).toBe(401);
  });
});

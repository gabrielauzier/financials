import type { FastifyInstance } from 'fastify';
import { DateTime } from 'luxon';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, closeAdminSql, createTestUser, type TestUser } from './helpers/db.js';
import { asUser, get, seedAccount, seedTransactions, startApp, type TxSeed } from './helpers/dashboards.js';

let app: FastifyInstance;
const SP = 'America/Sao_Paulo';

beforeAll(async () => {
  app = await startApp();
});

afterAll(async () => {
  await app.close();
  await cleanupTestUsers();
  await closeAdminSql();
});

async function fresh(rows: TxSeed[] = []) {
  const user = await createTestUser();
  const accountId = await seedAccount(user);
  await seedTransactions(user, accountId, rows);
  return user;
}

interface ExpenseTrend {
  months: string[];
  categories: { categoryId: string; name: string; color: string }[];
  points: { month: string; values: Record<string, string> }[];
}

const expenseTrend = async (user: TestUser, query = '', headers: Record<string, string> = {}) => {
  const res = await get(app, user, `/dashboard/expense-trend${query}`, headers);
  expect(res.statusCode).toBe(200);
  return res.json<ExpenseTrend>();
};

const cents = (value: string) => BigInt(value.replace('.', ''));
const idOf = (body: ExpenseTrend, name: string) => body.categories.find((c) => c.name === name)?.categoryId as string;

const MARCH_APRIL = '?from=2025-03-01&to=2025-04-30';

describe('GET /dashboard/expense-trend', () => {
  it('splits each month by category, largest period total first, with the category name and color', async () => {
    const user = await fresh([
      { type: 'Expense', amount: '100.00', at: '2025-03-05T12:00:00-03:00', category: 'Food' },
      { type: 'Expense', amount: '50.25', at: '2025-04-06T12:00:00-03:00', category: 'Food' },
      { type: 'Expense', amount: '200.00', at: '2025-03-07T12:00:00-03:00', category: 'Transport' },
      { type: 'Expense', amount: '80.00', at: '2025-04-08T12:00:00-03:00', category: 'Shopping' },
      { type: 'Income', amount: '5000.00', at: '2025-03-10T12:00:00-03:00', category: 'Salaries' },
    ]);
    const body = await expenseTrend(user, MARCH_APRIL, { 'x-timezone': SP });
    expect(body.months).toEqual(['2025-03', '2025-04']);
    expect(body.categories.map((c) => c.name)).toEqual(['Transporte', 'Alimentação', 'Compras']);
    const [transport, food, shopping] = body.categories.map((c) => c.categoryId) as [string, string, string];
    expect(body.points).toEqual([
      { month: '2025-03', values: { [transport]: '200.00', [food]: '100.00', [shopping]: '0.00' } },
      { month: '2025-04', values: { [transport]: '0.00', [food]: '50.25', [shopping]: '80.00' } },
    ]);
  });

  it('returns the palette key stored in categories.color, including after the user changes it', async () => {
    const user = await fresh([{ type: 'Expense', amount: '10.00', at: '2025-03-05T12:00:00-03:00', category: 'Food' }]);
    const stored = await asUser(user.id, (tx) => tx<{ color: string }[]>`select color from public.categories where key = 'Food'`);
    const before = await expenseTrend(user, MARCH_APRIL);
    expect(before.categories[0]?.color).toBe(stored[0]?.color);
    await asUser(user.id, (tx) => tx`update public.categories set color = 'pink-400' where key = 'Food'`);
    const after = await expenseTrend(user, MARCH_APRIL);
    expect(after.categories[0]?.color).toBe('pink-400');
    expect(after.categories[0]?.color).toMatch(/^[a-z]+-400$/);
  });

  it('shows Estorno as a negative value inside its own category', async () => {
    const user = await fresh([
      { type: 'Expense', amount: '100.00', at: '2025-03-05T12:00:00-03:00', category: 'Food' },
      { type: 'Income', amount: '30.00', at: '2025-04-09T12:00:00-03:00', category: 'Reversal' },
    ]);
    const body = await expenseTrend(user, MARCH_APRIL);
    const estorno = body.categories.find((c) => c.name.startsWith('Estorno'));
    expect(estorno).toBeDefined();
    const id = estorno?.categoryId as string;
    expect(body.points.map((p) => p.values[id])).toEqual(['0.00', '-30.00']);
    expect(body.categories.map((c) => c.name)).toEqual(['Alimentação', estorno?.name]);
  });

  it('omits categories whose sum over the period is zero (a Reversal typed Expense cancelled by a Reversal Income)', async () => {
    const user = await fresh([
      { type: 'Expense', amount: '30.00', at: '2025-03-05T12:00:00-03:00', category: 'Reversal' },
      { type: 'Income', amount: '30.00', at: '2025-04-05T12:00:00-03:00', category: 'Reversal' },
      { type: 'Expense', amount: '10.00', at: '2025-03-05T12:00:00-03:00', category: 'Food' },
      { type: 'Income', amount: '99.00', at: '2025-03-05T12:00:00-03:00', category: 'Salaries' },
    ]);
    const body = await expenseTrend(user, MARCH_APRIL);
    expect(body.categories.map((c) => c.name)).toEqual(['Alimentação']);
    for (const p of body.points) expect(Object.keys(p.values)).toEqual([body.categories[0]?.categoryId]);
  });

  it('gives each month of a gap a 0.00 value for every listed category (not a missing key)', async () => {
    const user = await fresh([
      { type: 'Expense', amount: '10.00', at: '2025-01-05T12:00:00-03:00', category: 'Food' },
      { type: 'Expense', amount: '20.00', at: '2025-04-05T12:00:00-03:00', category: 'Transport' },
    ]);
    const body = await expenseTrend(user, '?from=2025-01-01&to=2025-04-30');
    const food = idOf(body, 'Alimentação');
    const transport = idOf(body, 'Transporte');
    expect(body.points[1]).toEqual({ month: '2025-02', values: { [food]: '0.00', [transport]: '0.00' } });
    expect(body.points[2]).toEqual({ month: '2025-03', values: { [food]: '0.00', [transport]: '0.00' } });
  });

  it('is empty without data: months listed, no categories, empty values', async () => {
    const user = await fresh();
    const body = await expenseTrend(user, MARCH_APRIL);
    expect(body).toEqual({
      months: ['2025-03', '2025-04'],
      categories: [],
      points: [{ month: '2025-03', values: {} }, { month: '2025-04', values: {} }],
    });
    const rolling = await expenseTrend(user);
    expect(rolling.months).toHaveLength(12);
    expect(rolling.categories).toEqual([]);
  });

  it('defaults to the 12 rolling months and ignores older rows', async () => {
    const back = (n: number) => DateTime.now().setZone(SP).startOf('month').minus({ months: n }).set({ day: 10, hour: 12 }).toISO() as string;
    const user = await fresh([
      { type: 'Expense', amount: '10.00', at: back(11), category: 'Food' },
      { type: 'Expense', amount: '99.00', at: back(12), category: 'Food' },
    ]);
    const body = await expenseTrend(user, '', { 'x-timezone': SP });
    expect(body.months).toHaveLength(12);
    const food = idOf(body, 'Alimentação');
    expect(body.points[0]?.values[food]).toBe('10.00');
    expect(body.points.slice(1).every((p) => p.values[food] === '0.00')).toBe(true);
  });

  it('counts only rows inside the inclusive day range (partial end months)', async () => {
    const user = await fresh([
      { type: 'Expense', amount: '1.00', at: '2025-03-14T23:59:00-03:00', category: 'Food' },
      { type: 'Expense', amount: '10.00', at: '2025-03-15T00:00:00-03:00', category: 'Food' },
      { type: 'Expense', amount: '20.00', at: '2025-04-20T23:30:00-03:00', category: 'Food' },
      { type: 'Expense', amount: '2.00', at: '2025-04-21T00:00:00-03:00', category: 'Food' },
    ]);
    const body = await expenseTrend(user, '?from=2025-03-15&to=2025-04-20', { 'x-timezone': SP });
    const food = idOf(body, 'Alimentação');
    expect(body.points.map((p) => p.values[food])).toEqual(['10.00', '20.00']);
  });

  it('keeps the rules: neutral, CreditCard, Investments and future rows are not expenses', async () => {
    const at = '2025-03-10T12:00:00-03:00';
    const future = DateTime.now().setZone(SP).plus({ days: 2 });
    const user = await fresh([
      { type: 'Expense', amount: '1.00', at, category: 'Food', neutral: true },
      { type: 'Expense', amount: '2.00', at, category: 'Shopping', method: 'CreditCard' },
      { type: 'Expense', amount: '3.00', at, category: 'Investments' },
      { type: 'Expense', amount: '50.00', at: future.toISO() as string, category: 'Transport' },
    ]);
    expect((await expenseTrend(user, '?from=2025-03-01&to=2025-03-31')).categories).toEqual([]);
    const month = `?from=${future.startOf('month').toFormat('yyyy-MM-dd')}&to=${future.endOf('month').toFormat('yyyy-MM-dd')}`;
    expect((await expenseTrend(user, month, { 'x-timezone': SP })).categories).toEqual([]);
  });

  it('adds up, over every category and month, to the total expense /dashboard/categories reports for the same period', async () => {
    const user = await fresh([
      { type: 'Expense', amount: '100.10', at: '2025-03-05T12:00:00-03:00', category: 'Food' },
      { type: 'Expense', amount: '50.25', at: '2025-04-06T12:00:00-03:00', category: 'Food' },
      { type: 'Expense', amount: '200.00', at: '2025-03-07T12:00:00-03:00', category: 'Transport' },
      { type: 'Expense', amount: '80.35', at: '2025-04-08T12:00:00-03:00', category: 'Shopping' },
      { type: 'Income', amount: '30.00', at: '2025-04-09T12:00:00-03:00', category: 'Reversal' },
      { type: 'Expense', amount: '9.00', at: '2025-02-28T23:59:00-03:00', category: 'Food' }, // outside
      { type: 'Expense', amount: '9.00', at: '2025-03-10T12:00:00-03:00', category: 'Shopping', method: 'CreditCard' },
    ]);
    const body = await expenseTrend(user, MARCH_APRIL, { 'x-timezone': SP });
    const all = body.points.flatMap((p) => Object.values(p.values)).reduce((s, v) => s + cents(v), 0n);
    const cat = await get(app, user, '/dashboard/categories?from=2025-03-01&to=2025-04-30', { 'x-timezone': SP });
    const catTotal = cat.json<{ items: { total: string }[] }>().items.reduce((s, i) => s + cents(i.total), 0n);
    expect(all).toBe(catTotal);
    expect(all).toBe(40070n); // 100.10 + 50.25 + 200.00 + 80.35 - 30.00 = 400.70
  });

  it('puts a 23:30 local row at the end of a month in that month for America/Sao_Paulo and in the next for UTC', async () => {
    const user = await fresh([{ type: 'Expense', amount: '25.00', at: '2025-03-31T23:30:00-03:00', category: 'Food' }]);
    const sp = await expenseTrend(user, MARCH_APRIL, { 'x-timezone': SP });
    const food = idOf(sp, 'Alimentação');
    expect(sp.points.map((p) => p.values[food])).toEqual(['25.00', '0.00']);
    const utc = await expenseTrend(user, MARCH_APRIL, { 'x-timezone': 'UTC' });
    expect(utc.points.map((p) => p.values[idOf(utc, 'Alimentação')])).toEqual(['0.00', '25.00']);
  });

  it('crosses the year border (31/12 23:30 local stays in December in Sao Paulo)', async () => {
    const user = await fresh([{ type: 'Expense', amount: '25.00', at: '2024-12-31T23:30:00-03:00', category: 'Food' }]);
    const sp = await expenseTrend(user, '?from=2024-12-01&to=2025-01-31', { 'x-timezone': SP });
    expect(sp.points.map((p) => p.values[idOf(sp, 'Alimentação')])).toEqual(['25.00', '0.00']);
    const utc = await expenseTrend(user, '?from=2024-12-01&to=2025-01-31', { 'x-timezone': 'UTC' });
    expect(utc.points.map((p) => p.values[idOf(utc, 'Alimentação')])).toEqual(['0.00', '25.00']);
  });

  it('sums 1001 x 999999999999.99 exactly in one category (no float)', async () => {
    const user = await fresh(
      Array.from({ length: 1001 }, (_, i) => ({ name: `Grande ${i}`, type: 'Expense' as const, amount: '999999999999.99', at: '2025-03-10T12:00:00-03:00', category: 'Food' })),
    );
    const body = await expenseTrend(user, '?from=2025-03-01&to=2025-03-31');
    expect(body.points[0]?.values[idOf(body, 'Alimentação')]).toBe('1000999999999989.99');
  });

  it.each([
    ['from after to', '?from=2025-03-02&to=2025-03-01'],
    ['only from', '?from=2025-03-01'],
    ['only to', '?to=2025-03-01'],
    ['a malformed date', '?from=2025-3-1&to=2025-03-31'],
    ['more than 120 months', '?from=2015-01-01&to=2025-01-01'],
  ])('rejects %s with 422 invalid_period', async (_name, query) => {
    const user = await fresh();
    const res = await get(app, user, `/dashboard/expense-trend${query}`);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('invalid_period');
  });

  it('isolates users', async () => {
    const mine = await fresh([{ type: 'Expense', amount: '3.00', at: '2025-03-10T12:00:00-03:00', category: 'Food' }]);
    await fresh([{ type: 'Expense', amount: '900.00', at: '2025-03-10T12:00:00-03:00', category: 'Food' }]);
    const body = await expenseTrend(mine, '?from=2025-03-01&to=2025-03-31');
    expect(body.points[0]?.values[idOf(body, 'Alimentação')]).toBe('3.00');
  });

  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/dashboard/expense-trend' })).statusCode).toBe(401);
  });
});

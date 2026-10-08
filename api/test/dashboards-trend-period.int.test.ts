import type { FastifyInstance } from 'fastify';
import { DateTime } from 'luxon';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, closeAdminSql, createTestUser } from './helpers/db.js';
import { get, seedAccount, seedTransactions, startApp, type TxSeed } from './helpers/dashboards.js';

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
  return { user, accountId };
}

interface Point {
  month: string;
  income: string;
  expense: string;
  balance: string;
}
interface Trend {
  points: Point[];
  totals: { income: string; expense: string; balance: string };
}

const trend = async (user: Awaited<ReturnType<typeof fresh>>['user'], query: string, headers: Record<string, string> = {}) => {
  const res = await get(app, user, `/dashboard/trend${query}`, headers);
  expect(res.statusCode).toBe(200);
  return res.json<Trend>();
};

const cents = (value: string) => BigInt(value.replace('.', ''));
const sumCents = (values: string[]) => values.reduce((sum, v) => sum + cents(v), 0n);
const ZERO = { income: '0.00', expense: '0.00', balance: '0.00' };

describe('GET /dashboard/trend with a period', () => {
  it('draws one point per local month from the month of from to the month of to, counting only rows inside the inclusive day range', async () => {
    const { user } = await fresh([
      { type: 'Expense', amount: '1.00', at: '2025-03-14T23:59:00-03:00' }, // the day before from: out
      { type: 'Expense', amount: '10.00', at: '2025-03-15T00:00:00-03:00' }, // first instant of from: in
      { type: 'Income', amount: '500.00', at: '2025-03-31T23:30:00-03:00' },
      { type: 'Expense', amount: '20.00', at: '2025-04-10T12:00:00-03:00' },
      { type: 'Expense', amount: '30.00', at: '2025-05-20T23:30:00-03:00' }, // last day of to: in
      { type: 'Expense', amount: '2.00', at: '2025-05-21T00:00:00-03:00' }, // the day after to: out
      { type: 'Income', amount: '9.00', at: '2025-06-10T12:00:00-03:00' }, // month after to: out
    ]);
    const body = await trend(user, '?from=2025-03-15&to=2025-05-20', { 'x-timezone': SP });
    expect(body.points).toEqual([
      { month: '2025-03', income: '500.00', expense: '10.00', balance: '490.00' },
      { month: '2025-04', income: '0.00', expense: '20.00', balance: '-20.00' },
      { month: '2025-05', income: '0.00', expense: '30.00', balance: '-30.00' },
    ]);
    expect(body.totals).toEqual({ income: '500.00', expense: '60.00', balance: '440.00' });
  });

  it('returns zero points for months without data and totals equal to the sum of the points', async () => {
    const { user } = await fresh([
      { type: 'Income', amount: '100.10', at: '2025-02-10T12:00:00-03:00' },
      { type: 'Expense', amount: '40.20', at: '2025-02-11T12:00:00-03:00' },
    ]);
    const body = await trend(user, '?from=2025-01-01&to=2025-04-30');
    expect(body.points.map((p) => p.month)).toEqual(['2025-01', '2025-02', '2025-03', '2025-04']);
    expect(body.points[0]).toEqual({ month: '2025-01', ...ZERO });
    expect(body.points[2]).toEqual({ month: '2025-03', ...ZERO });
    expect(body.points[1]).toEqual({ month: '2025-02', income: '100.10', expense: '40.20', balance: '59.90' });
    expect(cents(body.totals.income)).toBe(sumCents(body.points.map((p) => p.income)));
    expect(cents(body.totals.expense)).toBe(sumCents(body.points.map((p) => p.expense)));
    expect(cents(body.totals.balance)).toBe(cents(body.totals.income) - cents(body.totals.expense));
    expect(body.totals).toEqual({ income: '100.10', expense: '40.20', balance: '59.90' });
  });

  it('gives zero totals and zero points for a user without data', async () => {
    const { user } = await fresh();
    const body = await trend(user, '?from=2025-01-01&to=2025-02-28');
    expect(body.points).toEqual([
      { month: '2025-01', ...ZERO },
      { month: '2025-02', ...ZERO },
    ]);
    expect(body.totals).toEqual(ZERO);
  });

  it('accepts a single-day period and charts its month', async () => {
    const { user } = await fresh([
      { type: 'Expense', amount: '7.00', at: '2025-03-15T12:00:00-03:00' },
      { type: 'Expense', amount: '5.00', at: '2025-03-16T12:00:00-03:00' },
    ]);
    const body = await trend(user, '?from=2025-03-15&to=2025-03-15');
    expect(body.points).toEqual([{ month: '2025-03', income: '0.00', expense: '7.00', balance: '-7.00' }]);
    expect(body.totals.expense).toBe('7.00');
  });

  it('keeps the rules: Reversal abates; neutral, CreditCard and Investments rows stay out of points and totals', async () => {
    const at = '2025-03-10T12:00:00-03:00';
    const { user } = await fresh([
      { type: 'Income', amount: '500.00', at, category: 'Salaries' },
      { type: 'Expense', amount: '120.00', at, category: 'Food' },
      { type: 'Income', amount: '20.00', at, category: 'Reversal' },
      { type: 'Expense', amount: '1.00', at, neutral: true },
      { type: 'Expense', amount: '2.00', at, method: 'CreditCard' },
      { type: 'Expense', amount: '3.00', at, category: 'Investments' },
    ]);
    const body = await trend(user, '?from=2025-03-01&to=2025-03-31');
    expect(body.totals).toEqual({ income: '500.00', expense: '100.00', balance: '400.00' });
    expect(body.points).toEqual([{ month: '2025-03', income: '500.00', expense: '100.00', balance: '400.00' }]);
  });

  it('excludes a future-dated row inside the requested range', async () => {
    const future = DateTime.now().setZone(SP).plus({ days: 2 });
    const { user } = await fresh([{ type: 'Expense', amount: '50.00', at: future.toISO() as string }]);
    const from = future.startOf('month').toFormat('yyyy-MM-dd');
    const to = future.endOf('month').toFormat('yyyy-MM-dd');
    const body = await trend(user, `?from=${from}&to=${to}`, { 'x-timezone': SP });
    expect(body.totals).toEqual(ZERO);
    expect(body.points.every((p) => p.expense === '0.00')).toBe(true);
  });

  it('puts a 23:30 local row on the last day of a month in that month for America/Sao_Paulo and in the next for UTC', async () => {
    const { user } = await fresh([{ type: 'Expense', amount: '25.00', at: '2025-03-31T23:30:00-03:00' }]);
    const sp = await trend(user, '?from=2025-03-01&to=2025-04-30', { 'x-timezone': SP });
    expect(sp.points.map((p) => p.expense)).toEqual(['25.00', '0.00']);
    // 23:30 at UTC-3 is 02:30 UTC on April 1st.
    const utc = await trend(user, '?from=2025-03-01&to=2025-04-30', { 'x-timezone': 'UTC' });
    expect(utc.points.map((p) => p.expense)).toEqual(['0.00', '25.00']);
    // The day filter follows the zone as well: March 31st alone holds the row in Sao Paulo, not in UTC.
    expect((await trend(user, '?from=2025-03-31&to=2025-03-31', { 'x-timezone': SP })).totals.expense).toBe('25.00');
    expect((await trend(user, '?from=2025-03-31&to=2025-03-31', { 'x-timezone': 'UTC' })).totals.expense).toBe('0.00');
  });

  it('crosses the year border: 31/12 23:30 stays in December in Sao Paulo and moves to January in UTC', async () => {
    const { user } = await fresh([
      { type: 'Income', amount: '80.00', at: '2024-12-31T23:30:00-03:00' },
      { type: 'Income', amount: '5.00', at: '2025-01-01T00:00:00-03:00' },
    ]);
    const sp = await trend(user, '?from=2024-12-01&to=2025-01-31', { 'x-timezone': SP });
    expect(sp.points.map((p) => [p.month, p.income])).toEqual([['2024-12', '80.00'], ['2025-01', '5.00']]);
    const utc = await trend(user, '?from=2024-12-01&to=2025-01-31', { 'x-timezone': 'UTC' });
    expect(utc.points.map((p) => [p.month, p.income])).toEqual([['2024-12', '0.00'], ['2025-01', '85.00']]);
  });

  it('shows a whole year from January to December', async () => {
    const { user } = await fresh([
      { type: 'Expense', amount: '1.00', at: '2024-12-31T12:00:00-03:00' },
      { type: 'Expense', amount: '2.00', at: '2025-01-01T12:00:00-03:00' },
      { type: 'Expense', amount: '4.00', at: '2025-12-31T12:00:00-03:00' },
    ]);
    const body = await trend(user, '?from=2025-01-01&to=2025-12-31', { 'x-timezone': SP });
    expect(body.points).toHaveLength(12);
    expect(body.points[0]?.month).toBe('2025-01');
    expect(body.points[11]?.month).toBe('2025-12');
    expect(body.totals.expense).toBe('6.00');
  });

  it('accepts a period of exactly 120 months and rejects 121 with 422 invalid_period', async () => {
    const { user } = await fresh();
    const ok = await trend(user, '?from=2015-01-01&to=2024-12-31');
    expect(ok.points).toHaveLength(120);
    const res = await get(app, user, '/dashboard/trend?from=2015-01-01&to=2025-01-01');
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('invalid_period');
    const huge = await get(app, user, '/dashboard/trend?from=0001-01-01&to=2025-01-01');
    expect(huge.statusCode).toBe(422);
  });

  it.each([
    ['from after to', '?from=2025-03-02&to=2025-03-01'],
    ['only from', '?from=2025-03-01'],
    ['only to', '?to=2025-03-01'],
    ['an impossible day', '?from=2025-02-30&to=2025-03-01'],
    ['a malformed date', '?from=03/01/2025&to=2025-03-31'],
  ])('rejects %s with 422 invalid_period', async (_name, query) => {
    const { user } = await fresh();
    const res = await get(app, user, `/dashboard/trend${query}`);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('invalid_period');
  });

  it('names the missing field', async () => {
    const { user } = await fresh();
    expect((await get(app, user, '/dashboard/trend?from=2025-03-01')).json().error.field).toBe('to');
    expect((await get(app, user, '/dashboard/trend?to=2025-03-01')).json().error.field).toBe('from');
  });

  it('sums 1001 x 999999999999.99 exactly in points and totals (no float)', async () => {
    const { user } = await fresh(
      Array.from({ length: 1001 }, (_, i) => ({ name: `Grande ${i}`, type: 'Expense' as const, amount: '999999999999.99', at: '2025-03-10T12:00:00-03:00', category: 'Food' })),
    );
    const body = await trend(user, '?from=2025-03-01&to=2025-03-31');
    expect(body.points[0]?.expense).toBe('1000999999999989.99');
    expect(body.totals).toEqual({ income: '0.00', expense: '1000999999999989.99', balance: '-1000999999999989.99' });
  });

  it('isolates users: another user rows never enter the points or totals', async () => {
    const mine = await fresh([{ type: 'Expense', amount: '3.00', at: '2025-03-10T12:00:00-03:00' }]);
    await fresh([{ type: 'Expense', amount: '900.00', at: '2025-03-10T12:00:00-03:00' }]);
    expect((await trend(mine.user, '?from=2025-03-01&to=2025-03-31')).totals.expense).toBe('3.00');
  });
});

describe('GET /dashboard/trend without a period', () => {
  it('keeps the 12 rolling months and adds totals equal to the sum of the points', async () => {
    const back = (n: number) => DateTime.now().setZone(SP).startOf('month').minus({ months: n }).set({ day: 10, hour: 12 }).toISO() as string;
    const { user } = await fresh([
      { type: 'Income', amount: '1000.00', at: back(5), category: 'Salaries' },
      { type: 'Expense', amount: '300.25', at: back(5), category: 'Food' },
      { type: 'Expense', amount: '40.50', at: back(11), category: 'Food' },
      { type: 'Expense', amount: '999.00', at: back(12), category: 'Food' }, // month 12 back: out of the totals too
    ]);
    const body = await trend(user, '', { 'x-timezone': SP });
    expect(body.points).toHaveLength(12);
    expect(body.totals).toEqual({ income: '1000.00', expense: '340.75', balance: '659.25' });
    expect(cents(body.totals.expense)).toBe(sumCents(body.points.map((p) => p.expense)));
  });

  it('returns zero totals for a user without data', async () => {
    const { user } = await fresh();
    expect((await trend(user, '')).totals).toEqual(ZERO);
  });
});

it('requires authentication on /dashboard/trend with a period', async () => {
  expect((await app.inject({ method: 'GET', url: '/dashboard/trend?from=2025-01-01&to=2025-01-31' })).statusCode).toBe(401);
});

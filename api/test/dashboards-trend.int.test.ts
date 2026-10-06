import type { FastifyInstance } from 'fastify';
import { DateTime } from 'luxon';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, closeAdminSql, createTestUser } from './helpers/db.js';
import { get, seedAccount, seedTransactions, startApp } from './helpers/dashboards.js';

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

async function fresh() {
  const user = await createTestUser();
  const accountId = await seedAccount(user);
  return { user, accountId };
}

interface Point {
  month: string;
  income: string;
  expense: string;
  balance: string;
}

const ZERO = { income: '0.00', expense: '0.00', balance: '0.00' };

/** `YYYY-MM` of the month `back` months before the current one in `zone`. */
const monthKey = (back: number, zone = SP) => DateTime.now().setZone(zone).startOf('month').minus({ months: back }).toFormat('yyyy-MM');

/** Mid-month instant (day 10, 12:00 local) of the month `back` months ago. */
const midMonth = (back: number, zone = SP) =>
  DateTime.now().setZone(zone).startOf('month').minus({ months: back }).set({ day: 10, hour: 12 }).toISO() as string;

describe('GET /dashboard/trend', () => {
  it('returns 12 months oldest first (11 previous plus the current), with 0.00 in the 9 months without transactions', async () => {
    const { user, accountId } = await fresh();
    await seedTransactions(user, accountId, [
      { type: 'Income', amount: '1000.00', at: midMonth(5), category: 'Salaries' },
      { type: 'Expense', amount: '300.00', at: midMonth(5), category: 'Food' },
      { type: 'Expense', amount: '40.50', at: midMonth(2), category: 'Food' },
      { type: 'Income', amount: '10.00', at: midMonth(1), category: 'Salaries' },
    ]);
    const res = await get(app, user, '/dashboard/trend');
    expect(res.statusCode).toBe(200);
    const { points } = res.json<{ points: Point[] }>();
    expect(points.map((p) => p.month)).toEqual(Array.from({ length: 12 }, (_, i) => monthKey(11 - i)));
    const byMonth = new Map(points.map((p) => [p.month, p]));
    expect(byMonth.get(monthKey(5))).toEqual({ month: monthKey(5), income: '1000.00', expense: '300.00', balance: '700.00' });
    expect(byMonth.get(monthKey(2))).toEqual({ month: monthKey(2), income: '0.00', expense: '40.50', balance: '-40.50' });
    expect(byMonth.get(monthKey(1))).toEqual({ month: monthKey(1), income: '10.00', expense: '0.00', balance: '10.00' });
    const empty = points.filter((p) => ![monthKey(5), monthKey(2), monthKey(1)].includes(p.month));
    expect(empty).toHaveLength(9);
    for (const p of empty) expect(p).toEqual({ month: p.month, ...ZERO });
  });

  it('includes the oldest of the 12 months (11 back) and leaves out the month 12 back', async () => {
    const { user, accountId } = await fresh();
    await seedTransactions(user, accountId, [
      { type: 'Income', amount: '200.00', at: midMonth(11), category: 'Salaries' },
      { type: 'Expense', amount: '75.25', at: midMonth(11), category: 'Food' },
      { type: 'Expense', amount: '999.00', at: midMonth(12), category: 'Food' },
    ]);
    const { points } = (await get(app, user, '/dashboard/trend')).json<{ points: Point[] }>();
    expect(points).toHaveLength(12);
    expect(points[0]).toEqual({ month: monthKey(11), income: '200.00', expense: '75.25', balance: '124.75' });
    expect(points.some((p) => p.month === monthKey(12))).toBe(false);
  });

  it('returns 12 zero months for a user without data', async () => {
    const { user } = await fresh();
    const { points } = (await get(app, user, '/dashboard/trend')).json<{ points: Point[] }>();
    expect(points).toHaveLength(12);
    for (const p of points) expect(p).toEqual({ month: p.month, ...ZERO });
  });

  it('computes balance as income minus expense each month, with Reversal abating and special rows ignored', async () => {
    const { user, accountId } = await fresh();
    const at = midMonth(3);
    await seedTransactions(user, accountId, [
      { type: 'Income', amount: '500.00', at, category: 'Salaries' },
      { type: 'Expense', amount: '120.00', at, category: 'Food' },
      { type: 'Income', amount: '20.00', at, category: 'Reversal' },
      { type: 'Expense', amount: '1.00', at, neutral: true },
      { type: 'Expense', amount: '2.00', at, method: 'CreditCard' },
      { type: 'Expense', amount: '3.00', at, category: 'Investments' },
      { type: 'Income', amount: '4.00', at, category: 'Investments' },
    ]);
    const { points } = (await get(app, user, '/dashboard/trend')).json<{ points: Point[] }>();
    expect(points.find((p) => p.month === monthKey(3))).toEqual({
      month: monthKey(3),
      income: '500.00',
      expense: '100.00',
      balance: '400.00',
    });
  });

  it('ignores future-dated rows in the current month', async () => {
    const { user, accountId } = await fresh();
    await seedTransactions(user, accountId, [
      { type: 'Expense', amount: '50.00', at: DateTime.now().plus({ days: 2 }).toISO() as string },
    ]);
    const { points } = (await get(app, user, '/dashboard/trend')).json<{ points: Point[] }>();
    expect(points[11]).toEqual({ month: monthKey(0), ...ZERO });
  });

  it('assigns a transaction at 23:30 local on the last day of a month to that month (America/Sao_Paulo)', async () => {
    const { user, accountId } = await fresh();
    const lastNight = DateTime.now().setZone(SP).startOf('month').minus({ days: 1 }).set({ hour: 23, minute: 30 });
    await seedTransactions(user, accountId, [{ type: 'Expense', amount: '25.00', at: lastNight.toISO() as string }]);
    const { points } = (await get(app, user, '/dashboard/trend', { 'x-timezone': SP })).json<{ points: Point[] }>();
    expect(points.find((p) => p.month === monthKey(1))?.expense).toBe('25.00');
    expect(points[11]?.expense).toBe('0.00');
  });

  it('moves that same transaction to the next month when the zone is UTC (zone change recalculates on the next read)', async () => {
    const { user, accountId } = await fresh();
    const lastNight = DateTime.now().setZone(SP).startOf('month').minus({ days: 1 }).set({ hour: 23, minute: 30 });
    await seedTransactions(user, accountId, [{ type: 'Expense', amount: '25.00', at: lastNight.toISO() as string }]);
    const { points } = (await get(app, user, '/dashboard/trend', { 'x-timezone': 'UTC' })).json<{ points: Point[] }>();
    // 23:30 at UTC-3 is 02:30 UTC of the 1st, so the UTC month is the one after the Sao Paulo month.
    const utcMonth = lastNight.setZone('UTC').toFormat('yyyy-MM');
    expect(utcMonth).not.toBe(lastNight.toFormat('yyyy-MM'));
    expect(points.find((p) => p.month === utcMonth)?.expense).toBe('25.00');
    expect(points.find((p) => p.month === lastNight.toFormat('yyyy-MM'))?.expense).toBe('0.00');
  });

  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/dashboard/trend' })).statusCode).toBe(401);
  });
});

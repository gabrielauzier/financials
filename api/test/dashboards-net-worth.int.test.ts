import type { FastifyInstance } from 'fastify';
import { DateTime } from 'luxon';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, closeAdminSql, createTestUser } from './helpers/db.js';
import { get, seedAccount, seedReturns, seedTransactions, startApp, type TxSeed } from './helpers/dashboards.js';

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

async function fresh(rows: TxSeed[] = [], returns: { on: string; amount: string }[] = []) {
  const user = await createTestUser();
  const accountId = await seedAccount(user);
  await seedTransactions(user, accountId, rows);
  await seedReturns(user, accountId, returns);
  return { user, accountId };
}

interface NetWorth {
  current: string;
  series: { month: string; value: string }[];
}

const netWorth = async (user: Awaited<ReturnType<typeof fresh>>['user'], headers = {}) =>
  (await get(app, user, '/dashboard/net-worth', headers)).json<NetWorth>();

/** Mid-month instant / local date of the month `back` months before the current one. */
const monthStart = (back: number, zone = SP) => DateTime.now().setZone(zone).startOf('month').minus({ months: back });
const midMonth = (back: number) => monthStart(back).set({ day: 10, hour: 12 }).toISO() as string;
const midMonthDate = (back: number) => monthStart(back).set({ day: 10 }).toISODate() as string;
const key = (back: number, zone = SP) => monthStart(back, zone).toFormat('yyyy-MM');

describe('GET /dashboard/net-worth', () => {
  it('is income 1000.00 minus expense 300.00 plus return 50.00 = 750.00', async () => {
    const { user } = await fresh(
      [
        { type: 'Income', amount: '1000.00', at: midMonth(1), category: 'Salaries' },
        { type: 'Expense', amount: '300.00', at: midMonth(1), category: 'Food' },
      ],
      [{ on: midMonthDate(1), amount: '50.00' }],
    );
    const res = await get(app, user, '/dashboard/net-worth');
    expect(res.statusCode).toBe(200);
    expect(res.json<NetWorth>().current).toBe('750.00');
  });

  it('has one cumulative point per month from the first activity to the current month, with no gaps', async () => {
    const { user } = await fresh(
      [
        { type: 'Income', amount: '1000.00', at: midMonth(3), category: 'Salaries' },
        { type: 'Expense', amount: '300.00', at: midMonth(1), category: 'Food' },
      ],
      [{ on: midMonthDate(2), amount: '50.00' }],
    );
    const body = await netWorth(user);
    expect(body.series).toEqual([
      { month: key(3), value: '1000.00' },
      { month: key(2), value: '1050.00' }, // return of 50.00 in its month
      { month: key(1), value: '750.00' },
      { month: key(0), value: '750.00' }, // month without activity carries the value
    ]);
    expect(body.current).toBe('750.00');
  });

  it('starts the series at the first return when it comes before the first transaction, and counts negative returns', async () => {
    const { user } = await fresh(
      [{ type: 'Income', amount: '100.00', at: midMonth(1), category: 'Salaries' }],
      [{ on: midMonthDate(2), amount: '-20.00' }],
    );
    const body = await netWorth(user);
    expect(body.series).toEqual([
      { month: key(2), value: '-20.00' },
      { month: key(1), value: '80.00' },
      { month: key(0), value: '80.00' },
    ]);
  });

  it('counts the invoice payment as expense and Estorno as positive; Investments, neutral and CreditCard rows do not move the value', async () => {
    const at = midMonth(1);
    const { user } = await fresh([
      { type: 'Income', amount: '1000.00', at, category: 'Salaries' },
      { type: 'Expense', amount: '400.00', at, category: 'Bills', method: 'Boleto', name: 'Pagamento de fatura' },
      { type: 'Income', amount: '30.00', at, category: 'Reversal' },
      { type: 'Expense', amount: '200.00', at, category: 'Investments' },
      { type: 'Income', amount: '5.00', at, category: 'Investments' },
      { type: 'Expense', amount: '7.00', at, neutral: true },
      { type: 'Income', amount: '9.00', at, neutral: true },
      { type: 'Expense', amount: '11.00', at, method: 'CreditCard' },
    ]);
    expect((await netWorth(user)).current).toBe('630.00');
  });

  it('returns 0.00 and an empty series when there are no transactions or returns', async () => {
    const { user } = await fresh();
    expect(await netWorth(user)).toEqual({ current: '0.00', series: [] });
  });

  it('counts transactions of an inactive account', async () => {
    const user = await createTestUser();
    const inactive = await seedAccount(user, 'Antiga', false);
    await seedTransactions(user, inactive, [{ type: 'Income', amount: '40.00', at: midMonth(1), category: 'Salaries' }]);
    expect((await netWorth(user)).current).toBe('40.00');
  });

  it('ignores future-dated transactions and returns', async () => {
    const future = DateTime.now().setZone(SP).plus({ days: 3 });
    const { user } = await fresh(
      [
        { type: 'Income', amount: '100.00', at: midMonth(1), category: 'Salaries' },
        { type: 'Income', amount: '999.00', at: future.toISO() as string, category: 'Salaries' },
      ],
      [{ on: future.toISODate() as string, amount: '888.00' }],
    );
    expect((await netWorth(user)).current).toBe('100.00');
  });

  it('puts a transaction at 23:30 local on the last day of a month in that month (America/Sao_Paulo) and in the next one in UTC', async () => {
    const lastNight = monthStart(1).minus({ days: 1 }).set({ hour: 23, minute: 30 });
    const { user } = await fresh([{ type: 'Income', amount: '60.00', at: lastNight.toISO() as string, category: 'Salaries' }]);
    const sp = await netWorth(user, { 'x-timezone': SP });
    expect(sp.series[0]).toEqual({ month: lastNight.toFormat('yyyy-MM'), value: '60.00' });
    const utc = await netWorth(user, { 'x-timezone': 'UTC' });
    expect(utc.series[0]).toEqual({ month: lastNight.setZone('UTC').toFormat('yyyy-MM'), value: '60.00' });
    expect(utc.series[0]?.month).not.toBe(sp.series[0]?.month);
  });

  it.each([SP, 'UTC'])('counts a return dated on the 1st of a month in that month, not the previous one (%s)', async (zone) => {
    const first = monthStart(0, zone);
    const { user } = await fresh(
      [],
      [
        { on: first.minus({ days: 1 }).toISODate() as string, amount: '10.00' },
        { on: first.toISODate() as string, amount: '3.00' },
      ],
    );
    const body = await netWorth(user, { 'x-timezone': zone });
    expect(body.series).toEqual([
      { month: key(1, zone), value: '10.00' },
      { month: key(0, zone), value: '13.00' },
    ]);
    expect(body.current).toBe('13.00');
  });

  it.each([SP, 'UTC'])('counts a transaction at exactly 00:00 local on the 1st in that month, not the previous one (%s)', async (zone) => {
    const first = monthStart(0, zone);
    const { user } = await fresh([
      { type: 'Income', amount: '100.00', at: first.minus({ minutes: 1 }).toISO() as string, category: 'Salaries' },
      { type: 'Income', amount: '7.00', at: first.toISO() as string, category: 'Salaries' },
    ]);
    const body = await netWorth(user, { 'x-timezone': zone });
    expect(body.series).toEqual([
      { month: key(1, zone), value: '100.00' },
      { month: key(0, zone), value: '107.00' },
    ]);
  });

  it('returns 200 with 0.00 and an empty series when every transaction and return is future-dated', async () => {
    const future = DateTime.now().setZone(SP).plus({ days: 3 });
    const { user } = await fresh(
      [{ type: 'Income', amount: '500.00', at: future.toISO() as string, category: 'Salaries' }],
      [{ on: future.toISODate() as string, amount: '40.00' }],
    );
    const res = await get(app, user, '/dashboard/net-worth');
    expect(res.statusCode).toBe(200);
    expect(res.json<NetWorth>()).toEqual({ current: '0.00', series: [] });
  });

  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/dashboard/net-worth' })).statusCode).toBe(401);
  });
});

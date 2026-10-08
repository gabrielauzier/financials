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
  return user;
}

const years = async (user: Awaited<ReturnType<typeof fresh>>, zone?: string) => {
  const res = await get(app, user, '/dashboard/years', zone ? { 'x-timezone': zone } : {});
  expect(res.statusCode).toBe(200);
  return res.json<{ years: number[] }>().years;
};

describe('GET /dashboard/years', () => {
  it('lists the years with data, descending, skipping years without any', async () => {
    const user = await fresh([
      { type: 'Expense', amount: '1.00', at: '2023-06-10T12:00:00-03:00' },
      { type: 'Income', amount: '2.00', at: '2025-02-10T12:00:00-03:00' },
      { type: 'Expense', amount: '3.00', at: '2025-09-10T12:00:00-03:00' },
      { type: 'Expense', amount: '4.00', at: '2020-01-10T12:00:00-03:00' },
    ]);
    expect(await years(user, SP)).toEqual([2025, 2023, 2020]);
  });

  it('is empty for a user without transactions', async () => {
    expect(await years(await fresh(), SP)).toEqual([]);
  });

  it('counts only countable rows: neutral, CreditCard, Investments and future-dated rows do not make a year', async () => {
    const future = DateTime.now().setZone(SP).plus({ years: 1 }).startOf('year').plus({ days: 5 });
    const user = await fresh([
      { type: 'Expense', amount: '1.00', at: '2022-05-10T12:00:00-03:00', neutral: true },
      { type: 'Expense', amount: '1.00', at: '2021-05-10T12:00:00-03:00', method: 'CreditCard' },
      { type: 'Expense', amount: '1.00', at: '2020-05-10T12:00:00-03:00', category: 'Investments' },
      { type: 'Income', amount: '1.00', at: '2019-05-10T12:00:00-03:00', category: 'Investments' },
      { type: 'Expense', amount: '1.00', at: future.toISO() as string },
      { type: 'Expense', amount: '1.00', at: '2018-05-10T12:00:00-03:00' },
      { type: 'Expense', amount: '1.00', at: '2023-05-10T12:00:00-03:00' }, // countable rows on both sides of the excluded years
    ]);
    expect(await years(user, SP)).toEqual([2023, 2018]);
  });

  it('uses the user zone at the year border: 31/12 23:30 is still the old year in Sao Paulo and the new one in UTC', async () => {
    const user = await fresh([{ type: 'Expense', amount: '1.00', at: '2023-12-31T23:30:00-03:00' }]);
    expect(await years(user, SP)).toEqual([2023]);
    expect(await years(user, 'UTC')).toEqual([2024]);
  });

  it('puts 01/01 00:00 local in the new year in both zones', async () => {
    const sp = await fresh([{ type: 'Expense', amount: '1.00', at: '2022-01-01T00:00:00-03:00' }]);
    expect(await years(sp, SP)).toEqual([2022]);
    expect(await years(sp, 'UTC')).toEqual([2022]); // 03:00 UTC on the 1st
    const utc = await fresh([{ type: 'Expense', amount: '1.00', at: '2022-01-01T00:00:00Z' }]);
    expect(await years(utc, 'UTC')).toEqual([2022]);
    expect(await years(utc, SP)).toEqual([2021]); // 21:00 on 31/12 in Sao Paulo
  });

  it('lists both years when a row sits on each side of the border', async () => {
    const user = await fresh([
      { type: 'Expense', amount: '1.00', at: '2023-12-31T23:59:00-03:00' },
      { type: 'Expense', amount: '1.00', at: '2024-01-01T00:00:00-03:00' },
    ]);
    expect(await years(user, SP)).toEqual([2024, 2023]);
  });

  it('isolates users', async () => {
    const mine = await fresh([{ type: 'Expense', amount: '1.00', at: '2025-01-10T12:00:00-03:00' }]);
    await fresh([{ type: 'Expense', amount: '1.00', at: '2019-01-10T12:00:00-03:00' }]);
    expect(await years(mine, SP)).toEqual([2025]);
  });

  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/dashboard/years' })).statusCode).toBe(401);
  });
});

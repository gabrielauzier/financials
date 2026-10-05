import type { FastifyInstance } from 'fastify';
import { DateTime } from 'luxon';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, closeAdminSql, createTestUser } from './helpers/db.js';
import { get, localInstant, seedAccount, seedTransactions, startApp } from './helpers/dashboards.js';

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

describe('GET /dashboard/last-30-days', () => {
  it('returns total 150.00 and +50% for 100 and 50 in the window and 100 before', async () => {
    const { user, accountId } = await fresh();
    await seedTransactions(user, accountId, [
      { type: 'Expense', amount: '100.00', at: localInstant(1, SP), category: 'Food' },
      { type: 'Expense', amount: '50.00', at: localInstant(10, SP), category: 'Shopping' },
      { type: 'Expense', amount: '100.00', at: localInstant(40, SP), category: 'Food' },
      // Outside both windows: must not count anywhere.
      { type: 'Expense', amount: '999.00', at: localInstant(80, SP), category: 'Food' },
    ]);
    const res = await get(app, user, '/dashboard/last-30-days');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ total: '150.00', previousTotal: '100.00', changePct: 50 });
  });

  it('returns changePct null when the previous total is zero', async () => {
    const { user, accountId } = await fresh();
    await seedTransactions(user, accountId, [{ type: 'Expense', amount: '80.00', at: localInstant(2, SP) }]);
    const res = await get(app, user, '/dashboard/last-30-days');
    expect(res.json()).toEqual({ total: '80.00', previousTotal: '0.00', changePct: null });
  });

  it('returns 0.00 totals and a null change when there are no expenses', async () => {
    const { user } = await fresh();
    const res = await get(app, user, '/dashboard/last-30-days');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ total: '0.00', previousTotal: '0.00', changePct: null });
  });

  it('rounds the change to 1 decimal and reports a drop as negative', async () => {
    const { user, accountId } = await fresh();
    await seedTransactions(user, accountId, [
      { type: 'Expense', amount: '10.00', at: localInstant(2, SP) },
      { type: 'Expense', amount: '30.00', at: localInstant(35, SP) },
      { type: 'Expense', amount: '0.01', at: localInstant(36, SP) },
    ]);
    // (10.00 - 30.01) / 30.01 * 100 = -66.678... -> -66.7
    const res = await get(app, user, '/dashboard/last-30-days');
    expect(res.json()).toEqual({ total: '10.00', previousTotal: '30.01', changePct: -66.7 });
  });

  it('applies the shared rules: abates a Reversal and ignores neutral, CreditCard, Investments and future rows', async () => {
    const { user, accountId } = await fresh();
    await seedTransactions(user, accountId, [
      { type: 'Expense', amount: '100.00', at: localInstant(3, SP) },
      { type: 'Income', amount: '25.00', at: localInstant(3, SP), category: 'Reversal' },
      { type: 'Income', amount: '500.00', at: localInstant(3, SP), category: 'Salaries' },
      { type: 'Expense', amount: '7.00', at: localInstant(3, SP), neutral: true },
      { type: 'Expense', amount: '8.00', at: localInstant(3, SP), method: 'CreditCard' },
      { type: 'Expense', amount: '9.00', at: localInstant(3, SP), category: 'Investments' },
      { type: 'Expense', amount: '11.00', at: DateTime.now().plus({ days: 3 }).toISO() as string },
    ]);
    const res = await get(app, user, '/dashboard/last-30-days');
    expect(res.json()).toMatchObject({ total: '75.00' });
  });

  for (const zone of [SP, 'UTC', 'Asia/Tokyo']) {
    it(`uses the local day boundaries of ${zone}: the first window instant counts now, the one before counts as previous`, async () => {
      const { user, accountId } = await fresh();
      const start = DateTime.now().setZone(zone).startOf('day').minus({ days: 29 });
      await seedTransactions(user, accountId, [
        { type: 'Expense', amount: '10.00', at: start.toISO() as string },
        { type: 'Expense', amount: '4.00', at: start.minus({ milliseconds: 1 }).toISO() as string },
      ]);
      const res = await get(app, user, '/dashboard/last-30-days', { 'x-timezone': zone });
      expect(res.json()).toEqual({ total: '10.00', previousTotal: '4.00', changePct: 150 });
    });
  }

  it('rejects an invalid time zone header with 400', async () => {
    const { user } = await fresh();
    const res = await get(app, user, '/dashboard/last-30-days', { 'x-timezone': 'Not/AZone' });
    expect(res.statusCode).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/last-30-days' });
    expect(res.statusCode).toBe(401);
  });
});

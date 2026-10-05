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

interface Item {
  categoryId: string;
  name: string;
  total: string;
}

const items = async (user: Awaited<ReturnType<typeof fresh>>['user'], query = '', headers = {}) =>
  (await get(app, user, `/dashboard/categories${query}`, headers)).json<{ items: Item[] }>().items;

/** Integer cents of decimal strings, so the test does no float math on money. */
const sumCents = (rows: Item[]) => rows.reduce((sum, r) => sum + Number(r.total.replace('.', '')), 0);

const MARCH = '?from=2026-03-01&to=2026-03-31';
const at = (day: string) => `2026-03-${day}T12:00:00-03:00`;

describe('GET /dashboard/categories', () => {
  it('groups expenses by category with Portuguese names and shows Estorno as a negative row; the sum equals the total expense', async () => {
    const { user } = await fresh([
      { type: 'Expense', amount: '100.00', at: at('05'), category: 'Food' },
      { type: 'Expense', amount: '50.25', at: at('06'), category: 'Food' },
      { type: 'Expense', amount: '200.00', at: at('07'), category: 'Transport' },
      { type: 'Expense', amount: '80.00', at: at('08'), category: 'Shopping' },
      { type: 'Income', amount: '30.00', at: at('09'), category: 'Reversal' },
      { type: 'Income', amount: '5000.00', at: at('10'), category: 'Salaries' }, // income is never an expense
    ]);
    const rows = await items(user, MARCH);
    expect(rows.map(({ name, total }) => ({ name, total }))).toEqual([
      { name: 'Transporte', total: '200.00' },
      { name: 'Alimentação', total: '150.25' },
      { name: 'Compras', total: '80.00' },
      { name: 'Estorno (de compras)', total: '-30.00' },
    ]);
    expect(rows[0]?.categoryId).toMatch(/^[0-9a-f-]{36}$/);
    // 200.00 + 150.25 + 80.00 - 30.00 = 400.25, the same figure the other panels use as total expense.
    const cents = sumCents(rows);
    expect(cents).toBe(40025);
  });

  it('matches the last-30-days total over the same window (one shared rule)', async () => {
    const start = DateTime.now().setZone(SP).startOf('day').minus({ days: 29 }).toISODate() as string;
    const end = DateTime.now().setZone(SP).toISODate() as string;
    const rowsAt = (days: number) => DateTime.now().setZone(SP).minus({ days }).set({ hour: 8 }).toISO() as string;
    const { user } = await fresh([
      { type: 'Expense', amount: '33.33', at: rowsAt(2), category: 'Food' },
      { type: 'Expense', amount: '10.10', at: rowsAt(3), category: 'Pets' },
      { type: 'Income', amount: '3.03', at: rowsAt(4), category: 'Reversal' },
      { type: 'Expense', amount: '9.00', at: rowsAt(5), neutral: true },
      { type: 'Expense', amount: '9.00', at: rowsAt(5), method: 'CreditCard' },
      { type: 'Expense', amount: '9.00', at: rowsAt(5), category: 'Investments' },
    ]);
    const rows = await items(user, `?from=${start}&to=${end}`);
    const cents = sumCents(rows);
    const last30 = (await get(app, user, '/dashboard/last-30-days')).json<{ total: string }>();
    expect(rows.map((r) => r.name).sort()).toEqual(['Alimentação', 'Estorno (de compras)', 'Pets']);
    expect(last30.total).toBe('40.40');
    expect(cents).toBe(4040);
  });

  it('defaults to the current local month', async () => {
    const monthStart = DateTime.now().setZone(SP).startOf('month');
    const { user } = await fresh([
      { type: 'Expense', amount: '12.00', at: monthStart.plus({ minutes: 5 }).toISO() as string, category: 'Food' },
      { type: 'Expense', amount: '99.00', at: monthStart.minus({ days: 1 }).toISO() as string, category: 'Food' },
    ]);
    const rows = await items(user);
    expect(rows.map(({ name, total }) => ({ name, total }))).toEqual([{ name: 'Alimentação', total: '12.00' }]);
  });

  it('recalculates for the selected period and returns an empty list when there are no expenses', async () => {
    const { user } = await fresh([{ type: 'Expense', amount: '12.00', at: at('15'), category: 'Food' }]);
    expect(await items(user, '?from=2026-03-16&to=2026-03-31')).toEqual([]);
    expect(await items(user, '?from=2026-03-15&to=2026-03-15')).toHaveLength(1);
    const { user: nobody } = await fresh();
    expect(await items(nobody)).toEqual([]);
  });

  it('omits a category whose rows sum to zero', async () => {
    const { user } = await fresh([
      { type: 'Expense', amount: '30.00', at: at('05'), category: 'Reversal' },
      { type: 'Income', amount: '30.00', at: at('06'), category: 'Reversal' },
      { type: 'Expense', amount: '10.00', at: at('05'), category: 'Food' },
    ]);
    const rows = await items(user, MARCH);
    expect(rows.map((r) => r.name)).toEqual(['Alimentação']);
  });

  it('treats a Reversal typed Expense as a normal expense in the Estorno category', async () => {
    const { user } = await fresh([{ type: 'Expense', amount: '20.00', at: at('05'), category: 'Reversal' }]);
    expect((await items(user, MARCH)).map(({ name, total }) => ({ name, total }))).toEqual([
      { name: 'Estorno (de compras)', total: '20.00' },
    ]);
  });

  it('ignores neutral, CreditCard, Investments and future-dated rows', async () => {
    const { user } = await fresh([
      { type: 'Expense', amount: '1.00', at: at('05'), neutral: true },
      { type: 'Expense', amount: '2.00', at: at('05'), method: 'CreditCard' },
      { type: 'Expense', amount: '3.00', at: at('05'), category: 'Investments' },
      { type: 'Expense', amount: '4.00', at: DateTime.now().plus({ days: 2 }).toISO() as string },
    ]);
    expect(await items(user, MARCH)).toEqual([]);
    expect(await items(user)).toEqual([]);
  });

  it('uses the local day of the zone: 23:30 on 31 March in Sao Paulo is April in UTC', async () => {
    const { user } = await fresh([
      { type: 'Expense', amount: '25.00', at: '2026-03-31T23:30:00-03:00', category: 'Food' },
    ]);
    expect(await items(user, MARCH, { 'x-timezone': SP })).toHaveLength(1);
    expect(await items(user, MARCH, { 'x-timezone': 'UTC' })).toEqual([]);
    expect(await items(user, '?from=2026-04-01&to=2026-04-30', { 'x-timezone': 'UTC' })).toHaveLength(1);
  });

  it('answers 422 invalid_period with the field for from after to, bad dates and a lone bound', async () => {
    const { user } = await fresh();
    for (const [query, field] of [
      ['?from=2026-03-31&to=2026-03-01', 'from'],
      ['?from=2026-02-30&to=2026-03-01', 'from'],
      ['?from=2026-03-01&to=31/03/2026', 'to'],
      ['?from=2026-03-01', 'to'],
      ['?to=2026-03-01', 'from'],
      ['?from=&to=', 'from'],
    ] as const) {
      const res = await get(app, user, `/dashboard/categories${query}`);
      expect({ query, status: res.statusCode }).toEqual({ query, status: 422 });
      expect(res.json()).toEqual({ error: { code: 'invalid_period', message: expect.any(String), field } });
    }
  });

  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/dashboard/categories' })).statusCode).toBe(401);
  });
});

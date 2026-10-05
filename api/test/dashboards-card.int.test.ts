import type { FastifyInstance } from 'fastify';
import { DateTime } from 'luxon';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
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
  return { user, accountId };
}

interface Card {
  transactions: { categoryName: string; total: string }[];
  creditExpenses: { categoryName: string; remaining: string }[];
}

const card = async (user: TestUser, query = '', headers = {}) =>
  (await get(app, user, `/dashboard/card${query}`, headers)).json<Card>();

const MARCH = '?from=2026-03-01&to=2026-03-31';
const at = (day: string) => `2026-03-${day}T12:00:00-03:00`;
const cc = (over: Partial<TxSeed>): TxSeed => ({ type: 'Expense', amount: '1.00', at: at('10'), method: 'CreditCard', ...over });

async function seedCreditExpense(
  user: TestUser,
  accountId: string,
  over: { category?: string; total: string; paid?: string; status: string },
): Promise<void> {
  await asUser(user.id, (tx) => tx`
    insert into public.credit_expenses
      (account_id, category_id, name, total_amount, paid_amount, occurred_at, recurrency_day, status)
    values (${accountId}, (select id from public.categories where key = ${over.category ?? 'Entertainment'}),
            'Item', ${over.total}, ${over.paid ?? '0'}, '2026-01-05T12:00:00Z', 5, ${over.status})`);
}

describe('GET /dashboard/card', () => {
  it('sums two CreditCard rows in Alimentação under that category', async () => {
    const { user } = await fresh([
      cc({ amount: '40.00', category: 'Food', at: at('05') }),
      cc({ amount: '25.50', category: 'Food', at: at('20') }),
      cc({ amount: '10.00', category: 'Transport' }),
      // Not card purchases: never listed here.
      { type: 'Expense', amount: '500.00', at: at('10'), category: 'Food', method: 'PIX' },
    ]);
    expect((await card(user, MARCH)).transactions).toEqual([
      { categoryName: 'Alimentação', total: '65.50' },
      { categoryName: 'Transporte', total: '10.00' },
    ]);
  });

  it('lists a neutral CreditCard purchase here although it stays out of the totals', async () => {
    const { user } = await fresh([cc({ amount: '15.00', category: 'Shopping', neutral: true })]);
    expect((await card(user, MARCH)).transactions).toEqual([{ categoryName: 'Compras', total: '15.00' }]);
    expect((await get(app, user, '/dashboard/categories?from=2026-03-01&to=2026-03-31')).json()).toEqual({ items: [] });
  });

  it('subtracts a CreditCard refund (Income) from its category', async () => {
    const { user } = await fresh([
      cc({ amount: '100.00', category: 'Shopping' }),
      cc({ type: 'Income', amount: '30.00', category: 'Shopping', at: at('11') }),
    ]);
    expect((await card(user, MARCH)).transactions).toEqual([{ categoryName: 'Compras', total: '70.00' }]);
  });

  it('shows total minus paid of Active, Once and ToCancel credit expenses only, grouped by category', async () => {
    const { user, accountId } = await fresh();
    await seedCreditExpense(user, accountId, { total: '600.00', paid: '200.00', status: 'Active' });
    await seedCreditExpense(user, accountId, { total: '100.00', paid: '0', status: 'Once' });
    await seedCreditExpense(user, accountId, { total: '50.00', paid: '10.00', status: 'ToCancel', category: 'Utilities' });
    for (const status of ['Inactive', 'Canceled']) {
      await seedCreditExpense(user, accountId, { total: '999.00', paid: '1.00', status });
    }
    // Credit expenses are an open balance: listed whatever the period.
    for (const query of ['', MARCH, '?from=2020-01-01&to=2020-01-02']) {
      expect((await card(user, query)).creditExpenses).toEqual([
        { categoryName: 'Entretenimento', remaining: '500.00' },
        { categoryName: 'Utilidades', remaining: '40.00' },
      ]);
    }
  });

  it('leaves last-30-days, trend, categories and net worth unchanged when a credit expense and CreditCard rows are added (CARD-05)', async () => {
    const recent = (days: number) => DateTime.now().setZone(SP).minus({ days }).set({ hour: 9 }).toISO() as string;
    const { user, accountId } = await fresh([
      { type: 'Income', amount: '1000.00', at: recent(5), category: 'Salaries' },
      { type: 'Expense', amount: '120.00', at: recent(4), category: 'Food' },
    ]);
    const urls = ['/dashboard/last-30-days', '/dashboard/trend', '/dashboard/categories', '/dashboard/net-worth'];
    const snapshot = async () => Promise.all(urls.map(async (u) => (await get(app, user, u)).json<unknown>()));
    const before = await snapshot();
    expect((before[3] as { current: string }).current).toBe('880.00');

    await seedCreditExpense(user, accountId, { total: '600.00', paid: '100.00', status: 'Active' });
    await seedTransactions(user, accountId, [
      { type: 'Expense', amount: '77.00', at: recent(2), category: 'Food', method: 'CreditCard' },
      { type: 'Expense', amount: '33.00', at: recent(1), category: 'Shopping', method: 'CreditCard', neutral: true },
    ]);

    expect(await snapshot()).toEqual(before);
    const today = DateTime.now().setZone(SP).toISODate();
    const after = await card(user, `?from=${DateTime.now().setZone(SP).minus({ days: 30 }).toISODate()}&to=${today}`);
    expect(after.transactions).toEqual([
      { categoryName: 'Alimentação', total: '77.00' },
      { categoryName: 'Compras', total: '33.00' },
    ]);
    expect(after.creditExpenses).toEqual([{ categoryName: 'Entretenimento', remaining: '500.00' }]);
  });

  it('returns empty lists for a user without data and for a period without card purchases', async () => {
    const { user } = await fresh();
    expect(await card(user)).toEqual({ transactions: [], creditExpenses: [] });
    const { user: other } = await fresh([cc({ at: at('10') })]);
    expect((await card(other, '?from=2026-04-01&to=2026-04-30')).transactions).toEqual([]);
  });

  it('defaults to the current local month and excludes future-dated purchases', async () => {
    const monthStart = DateTime.now().setZone(SP).startOf('month');
    const { user } = await fresh([
      cc({ amount: '12.00', category: 'Food', at: monthStart.plus({ minutes: 5 }).toISO() as string }),
      cc({ amount: '99.00', category: 'Food', at: monthStart.minus({ days: 1 }).toISO() as string }),
      cc({ amount: '55.00', category: 'Food', at: DateTime.now().plus({ days: 2 }).toISO() as string }),
    ]);
    expect((await card(user)).transactions).toEqual([{ categoryName: 'Alimentação', total: '12.00' }]);
  });

  it('uses the local day of the zone for the period (23:30 on 31 March in Sao Paulo is April in UTC)', async () => {
    const { user } = await fresh([cc({ amount: '25.00', at: '2026-03-31T23:30:00-03:00', category: 'Food' })]);
    expect((await card(user, MARCH, { 'x-timezone': SP })).transactions).toHaveLength(1);
    expect((await card(user, MARCH, { 'x-timezone': 'UTC' })).transactions).toEqual([]);
  });

  it('answers 422 invalid_period for from after to and for a lone bound', async () => {
    const { user } = await fresh();
    for (const [query, field] of [
      ['?from=2026-03-31&to=2026-03-01', 'from'],
      ['?from=2026-03-01', 'to'],
      ['?from=x&to=2026-03-01', 'from'],
    ] as const) {
      const res = await get(app, user, `/dashboard/card${query}`);
      expect({ query, status: res.statusCode }).toEqual({ query, status: 422 });
      expect(res.json()).toEqual({ error: { code: 'invalid_period', message: expect.any(String), field } });
    }
  });

  it('does not show other users credit expenses or card rows', async () => {
    const { user: a, accountId } = await fresh([cc({ amount: '8.00' })]);
    await seedCreditExpense(a, accountId, { total: '70.00', status: 'Active' });
    const { user: b } = await fresh();
    expect(await card(b, MARCH)).toEqual({ transactions: [], creditExpenses: [] });
    expect((await getAdminSql()`select count(*)::int as n from public.credit_expenses where user_id = ${a.id}`)[0]).toEqual({ n: 1 });
  });

  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/dashboard/card' })).statusCode).toBe(401);
  });
});

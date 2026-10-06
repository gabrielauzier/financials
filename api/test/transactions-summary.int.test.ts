import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COUNTABLE, EXPENSE_VALUE, FROM_TRANSACTIONS, INCOME_VALUE, rule } from '../src/modules/dashboards/rules.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { asUser, get, seedAccount, seedTransactions, startApp, type TxSeed } from './helpers/dashboards.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await startApp();
});

afterAll(async () => {
  await app.close();
  await cleanupTestUsers();
  await closeAdminSql();
});

interface Summary {
  count: number;
  income: string;
  expense: string;
  investments: string;
  balance: string;
}

const MID = '2026-01-11T12:00:00-03:00';
const FUTURE = '2099-01-10T12:00:00Z';
// Local-day boundaries of 2026-01-10 and 2026-01-12 in America/Sao_Paulo (the default zone, UTC-3).
const B_PREV_DAY_END = '2026-01-09T23:59:59-03:00'; // last second of Jan 9 local
const B_FROM_START = '2026-01-10T00:00:00-03:00'; // first instant of Jan 10 local
const B_TO_END = '2026-01-12T23:59:59-03:00'; // last second of Jan 12 local
const B_NEXT_DAY_START = '2026-01-13T00:00:00-03:00'; // first instant of Jan 13 local

/**
 * Fixed dataset (19 rows). Expected totals below are derived by hand from the spec rules, not from the code:
 * income counts Income that is not Reversal; expense counts Expense and subtracts the Reversal Income;
 * neutral, CreditCard, future-dated and (for income and expense) Investments rows never count.
 */
const DATASET: TxSeed[] = [
  { name: 'Salário', type: 'Income', amount: '1000.00', at: MID, category: 'Salaries' },
  { name: 'Mercado Central', type: 'Expense', amount: '100.00', at: MID, category: 'Food' },
  { name: 'Neutra saída', type: 'Expense', amount: '1.00', at: MID, category: 'Food', neutral: true },
  { name: 'Neutra entrada', type: 'Income', amount: '2.00', at: MID, category: 'Salaries', neutral: true },
  { name: 'Compra no cartão', type: 'Expense', amount: '3.00', at: MID, category: 'Food', method: 'CreditCard' },
  { name: 'Estorno no cartão', type: 'Income', amount: '4.00', at: MID, category: 'Salaries', method: 'CreditCard' },
  { name: 'Aporte', type: 'Expense', amount: '200.00', at: MID, category: 'Investments' },
  { name: 'Resgate', type: 'Income', amount: '5.00', at: MID, category: 'Investments' },
  { name: 'Estorno compra', type: 'Income', amount: '30.00', at: MID, category: 'Reversal' },
  { name: 'Estorno como despesa', type: 'Expense', amount: '20.00', at: MID, category: 'Reversal' },
  { name: 'Futura saída', type: 'Expense', amount: '6.00', at: FUTURE, category: 'Food' },
  { name: 'Futura entrada', type: 'Income', amount: '7.00', at: FUTURE, category: 'Salaries' },
  { name: 'Pagamento de fatura', type: 'Expense', amount: '10.00', at: MID, category: 'Utilities', method: 'BankTransfer' },
  // rows 14 and 15 go to the inactive account (see beforeAll)
  { name: 'Entrada antiga', type: 'Income', amount: '40.00', at: MID, category: 'Salaries' },
  { name: 'Café antigo', type: 'Expense', amount: '15.00', at: MID, category: 'Food' },
  { name: 'Borda 1', type: 'Expense', amount: '0.10', at: B_FROM_START, category: 'Food' },
  { name: 'Borda 2', type: 'Expense', amount: '0.20', at: B_PREV_DAY_END, category: 'Food' },
  { name: 'Borda 3', type: 'Expense', amount: '0.20', at: B_TO_END, category: 'Food' },
  { name: 'Borda 4', type: 'Expense', amount: '0.40', at: B_NEXT_DAY_START, category: 'Food' },
];

const zeros = { income: '0.00', expense: '0.00', investments: '0.00', balance: '0.00' };

async function categoryId(user: TestUser, key: string): Promise<string> {
  const [row] = await getAdminSql()`select id from public.categories where user_id = ${user.id} and key = ${key}`;
  return (row as { id: string }).id;
}

async function summary(as: TestUser, query = '', headers: Record<string, string> = {}): Promise<Summary> {
  const res = await get(app, as, `/transactions/summary${query === '' ? '' : `?${query}`}`, headers);
  expect(res.statusCode, res.body).toBe(200);
  return res.json<Summary>();
}

async function listTotal(as: TestUser, query = '', headers: Record<string, string> = {}): Promise<number> {
  const res = await get(app, as, `/transactions${query === '' ? '' : `?${query}`}`, headers);
  expect(res.statusCode, res.body).toBe(200);
  return res.json<{ total: number }>().total;
}

describe('GET /transactions/summary', () => {
  let owner: TestUser;
  let active: string;
  let inactive: string;
  let food: string;
  let investments: string;
  let reversal: string;

  beforeAll(async () => {
    owner = await createTestUser();
    active = await seedAccount(owner, 'Corrente');
    inactive = await seedAccount(owner, 'Antiga', false);
    await seedTransactions(
      owner,
      active,
      DATASET.map((row) => (row.name === 'Entrada antiga' || row.name === 'Café antigo' ? { ...row, accountId: inactive } : row)),
    );
    food = await categoryId(owner, 'Food');
    investments = await categoryId(owner, 'Investments');
    reversal = await categoryId(owner, 'Reversal');
  });

  describe('shape, authentication and isolation (TLIST-01)', () => {
    it('answers 200 with exactly count, income, expense, investments and balance, money with 2 decimals', async () => {
      const res = await get(app, owner, '/transactions/summary');
      expect(res.statusCode).toBe(200);
      const body = res.json<Record<string, unknown>>();
      expect(Object.keys(body).sort()).toEqual(['balance', 'count', 'expense', 'income', 'investments']);
      expect(Number.isInteger(body['count'])).toBe(true);
      for (const key of ['income', 'expense', 'investments', 'balance']) {
        expect(body[key], key).toMatch(/^-?\d+\.\d{2}$/);
      }
    });

    it('answers 401 without a token and with an invalid token', async () => {
      expect((await app.inject({ method: 'GET', url: '/transactions/summary' })).statusCode).toBe(401);
      const invalid = await app.inject({
        method: 'GET',
        url: '/transactions/summary',
        headers: { authorization: 'Bearer not-a-token' },
      });
      expect(invalid.statusCode).toBe(401);
    });

    it("never sums another user's rows, and each user gets only their own totals", async () => {
      const other = await createTestUser();
      const otherAccount = await seedAccount(other);
      await seedTransactions(other, otherAccount, [
        { type: 'Income', amount: '9000.00', at: MID, category: 'Salaries' },
        { type: 'Expense', amount: '500.00', at: MID, category: 'Food' },
      ]);
      expect(await summary(other)).toEqual({ count: 2, income: '9000.00', expense: '500.00', investments: '0.00', balance: '8500.00' });
      expect(await summary(owner)).toMatchObject({ count: 19, income: '1040.00', expense: '115.90' });
    });

    it('answers the zeros and count 0 for a user without transactions', async () => {
      const fresh = await createTestUser();
      expect(await summary(fresh)).toEqual({ count: 0, ...zeros });
    });
  });

  describe('rules over the fixed dataset (TLIST-03, TLIST-04)', () => {
    it('yields the totals the spec rules give for the 19 rows', async () => {
      // income: Salário 1000 + Entrada antiga 40 (inactive account counts) = 1040.00
      // expense: 100 + 20 (Reversal typed Expense) + 10 + 15 + (0.10 + 0.20 + 0.20 + 0.40) - 30 (Reversal Income) = 115.90
      // investments: Aporte 200 - Resgate 5 = 195.00; balance: income - expense = 924.10
      expect(await summary(owner)).toEqual({
        count: 19,
        income: '1040.00',
        expense: '115.90',
        investments: '195.00',
        balance: '924.10',
      });
    });

    it('equals the dashboard rules totals for income and expense over the same rows', async () => {
      const [rules] = await asUser(owner.id, (tx) => tx<{ income: string; expense: string }[]>`
        select coalesce(sum(${rule(tx, INCOME_VALUE)}), 0.00)::text as income,
               coalesce(sum(${rule(tx, EXPENSE_VALUE)}), 0.00)::text as expense
        from ${rule(tx, FROM_TRANSACTIONS)}
        where ${rule(tx, COUNTABLE)}`);
      const result = await summary(owner);
      expect({ income: result.income, expense: result.expense }).toEqual(rules);
    });

    it('equals the dashboard rules totals when the same filter is applied in SQL (category Food)', async () => {
      const [rules] = await asUser(owner.id, (tx) => tx<{ income: string; expense: string }[]>`
        select coalesce(sum(${rule(tx, INCOME_VALUE)}), 0.00)::text as income,
               coalesce(sum(${rule(tx, EXPENSE_VALUE)}), 0.00)::text as expense
        from ${rule(tx, FROM_TRANSACTIONS)}
        where ${rule(tx, COUNTABLE)} and t.category_id = ${food}`);
      const result = await summary(owner, `categoryId=${food}`);
      expect({ income: result.income, expense: result.expense }).toEqual(rules);
    });

    it('counts every row of the filter, including neutral, CreditCard, Investments and future-dated ones', async () => {
      const result = await summary(owner);
      expect(result.count).toBe(19);
      // 8 of the 19 rows are outside income and expense: 2 neutral, 2 CreditCard, 2 Investments, 2 future
      expect(await listTotal(owner)).toBe(19);
    });

    it('returns the zeros for the money fields and the row count when every row is future-dated', async () => {
      const user = await createTestUser();
      const account = await seedAccount(user);
      await seedTransactions(user, account, [
        { type: 'Income', amount: '10.00', at: FUTURE, category: 'Salaries' },
        { type: 'Expense', amount: '20.00', at: FUTURE, category: 'Food' },
        { type: 'Expense', amount: '30.00', at: FUTURE, category: 'Investments' },
      ]);
      expect(await summary(user)).toEqual({ count: 3, ...zeros });
    });

    it('sums 0.10 and 0.20 exactly as 0.30 (no floating point)', async () => {
      const user = await createTestUser();
      const account = await seedAccount(user);
      await seedTransactions(user, account, [
        { type: 'Expense', amount: '0.10', at: MID, category: 'Food' },
        { type: 'Expense', amount: '0.20', at: MID, category: 'Food' },
      ]);
      expect(await summary(user)).toEqual({ count: 2, income: '0.00', expense: '0.30', investments: '0.00', balance: '-0.30' });
    });

    it('makes the expense negative and the balance positive when only a Reversal Income exists', async () => {
      const user = await createTestUser();
      const account = await seedAccount(user);
      await seedTransactions(user, account, [{ type: 'Income', amount: '30.00', at: MID, category: 'Reversal' }]);
      expect(await summary(user)).toEqual({ count: 1, income: '0.00', expense: '-30.00', investments: '0.00', balance: '30.00' });
    });

    it('shows a negative investments total when redemptions exceed contributions, outside the balance', async () => {
      const user = await createTestUser();
      const account = await seedAccount(user);
      await seedTransactions(user, account, [
        { type: 'Expense', amount: '10.00', at: MID, category: 'Investments' },
        { type: 'Income', amount: '25.50', at: MID, category: 'Investments' },
      ]);
      expect(await summary(user)).toEqual({ count: 2, income: '0.00', expense: '0.00', investments: '-15.50', balance: '0.00' });
    });
  });

  describe('filters (TLIST-02, TLIST-04)', () => {
    it.each([
      ['type=Expense', { count: 12, income: '0.00', expense: '145.90', investments: '200.00', balance: '-145.90' }],
      ['type=Income', { count: 7, income: '1040.00', expense: '-30.00', investments: '-5.00', balance: '1070.00' }],
      ['neutral=true', { count: 2, ...zeros }],
      ['neutral=false', { count: 17, income: '1040.00', expense: '115.90', investments: '195.00', balance: '924.10' }],
    ])('filters by %s', async (query, expected) => {
      expect(await summary(owner, query)).toEqual(expected);
    });

    it('filters by category: Food, Investments and Reversal', async () => {
      expect(await summary(owner, `categoryId=${food}`)).toEqual({ count: 9, income: '0.00', expense: '115.90', investments: '0.00', balance: '-115.90' });
      expect(await summary(owner, `categoryId=${investments}`)).toEqual({ count: 2, income: '0.00', expense: '0.00', investments: '195.00', balance: '0.00' });
      expect(await summary(owner, `categoryId=${reversal}`)).toEqual({ count: 2, income: '0.00', expense: '-10.00', investments: '0.00', balance: '10.00' });
    });

    it('filters by account, active and inactive', async () => {
      expect(await summary(owner, `accountId=${inactive}`)).toEqual({ count: 2, income: '40.00', expense: '15.00', investments: '0.00', balance: '25.00' });
      expect(await summary(owner, `accountId=${active}`)).toEqual({ count: 17, income: '1000.00', expense: '100.90', investments: '195.00', balance: '899.10' });
    });

    it('includes the whole local day for from and to, at the first and last second of each day', async () => {
      // from Jan 10 keeps Borda 1 (00:00:00) and drops Borda 2 (Jan 9 23:59:59): count 18, expense 145.70 - 30
      expect(await summary(owner, 'from=2026-01-10')).toEqual({ count: 18, income: '1040.00', expense: '115.70', investments: '195.00', balance: '924.30' });
      // to Jan 9 keeps only Borda 2
      expect(await summary(owner, 'to=2026-01-09')).toEqual({ count: 1, income: '0.00', expense: '0.20', investments: '0.00', balance: '-0.20' });
      // Jan 10 to Jan 12 keeps Borda 1 and Borda 3 and drops Borda 2 and Borda 4 and the 2099 rows
      expect(await summary(owner, 'from=2026-01-10&to=2026-01-12')).toEqual({ count: 15, income: '1040.00', expense: '115.30', investments: '195.00', balance: '924.70' });
    });

    it('uses the X-Timezone zone for the local days', async () => {
      const day = 'from=2026-01-10&to=2026-01-10';
      // America/Sao_Paulo: Jan 10 local is 03:00Z to 02:59:59Z next day, which holds only Borda 1 (0.10)
      expect(await summary(owner, day)).toEqual({ count: 1, income: '0.00', expense: '0.10', investments: '0.00', balance: '-0.10' });
      // UTC: Jan 10 is 00:00Z to 23:59:59Z, which holds Borda 2 (02:59:59Z) and Borda 1 (03:00Z): 0.10 + 0.20
      expect(await summary(owner, day, { 'x-timezone': 'UTC' })).toEqual({ count: 2, income: '0.00', expense: '0.30', investments: '0.00', balance: '-0.30' });
    });

    it('searches the name ignoring case and accents', async () => {
      expect(await summary(owner, 'q=CAFE')).toEqual({ count: 1, income: '0.00', expense: '15.00', investments: '0.00', balance: '-15.00' });
      expect(await summary(owner, 'q=borda')).toEqual({ count: 4, income: '0.00', expense: '0.90', investments: '0.00', balance: '-0.90' });
    });

    it('combines the filters with AND', async () => {
      expect(await summary(owner, `type=Expense&categoryId=${food}&from=2026-01-10`)).toEqual({
        count: 8,
        income: '0.00',
        expense: '115.70',
        investments: '0.00',
        balance: '-115.70',
      });
    });

    it('answers 200 with the zeros for an inverted period, like the list answers with an empty page', async () => {
      expect(await summary(owner, 'from=2026-01-12&to=2026-01-10')).toEqual({ count: 0, ...zeros });
      expect(await listTotal(owner, 'from=2026-01-12&to=2026-01-10')).toBe(0);
    });

    it('answers the zeros for the account of another user, like the list answers with an empty page', async () => {
      const other = await createTestUser();
      const foreign = await seedAccount(other);
      expect(await summary(owner, `accountId=${foreign}`)).toEqual({ count: 0, ...zeros });
    });

    it.each([
      '',
      'type=Income',
      'type=Expense',
      'neutral=true',
      'neutral=false',
      'from=2026-01-10',
      'to=2026-01-12',
      'from=2026-01-10&to=2026-01-12',
      'q=borda',
      'q=cafe',
      'type=Expense&neutral=false&from=2026-01-10',
    ])('has the same count as the list total for "%s"', async (query) => {
      expect((await summary(owner, query)).count).toBe(await listTotal(owner, query));
    });

    it('has the same count as the list total for the account, category and timezone filters', async () => {
      for (const query of [`accountId=${active}`, `accountId=${inactive}`, `categoryId=${food}`, `categoryId=${investments}`]) {
        expect((await summary(owner, query)).count, query).toBe(await listTotal(owner, query));
      }
      const day = 'from=2026-01-10&to=2026-01-10';
      expect((await summary(owner, day, { 'x-timezone': 'UTC' })).count).toBe(await listTotal(owner, day, { 'x-timezone': 'UTC' }));
    });

    it('ignores sort, order, page and pageSize, whatever their values', async () => {
      const plain = await summary(owner);
      expect(await summary(owner, 'sort=amount&order=asc&page=9&pageSize=25')).toEqual(plain);
      expect(await summary(owner, 'sort=bogus&order=up&page=0&pageSize=7')).toEqual(plain);
    });

    it.each([
      ['type=Transfer', 'type'],
      ['neutral=maybe', 'neutral'],
      ['from=abc', 'from'],
      ['from=2026-13-01', 'from'],
      ['to=2026-02-30', 'to'],
      ['accountId=not-a-uuid', 'accountId'],
      ['categoryId=xyz', 'categoryId'],
    ])('rejects %s with 422 validation_error on field %s, like the list', async (query, field) => {
      const res = await get(app, owner, `/transactions/summary?${query}`);
      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({ error: { code: 'validation_error', message: expect.any(String), field } });
      const listed = await get(app, owner, `/transactions?${query}`);
      expect(listed.statusCode).toBe(422);
      expect(listed.json()).toEqual(res.json());
    });

    it('answers a repeated filter parameter like the list: 400 validation_error', async () => {
      const summaryRes = await get(app, owner, '/transactions/summary?type=Income&type=Expense');
      const listRes = await get(app, owner, '/transactions?type=Income&type=Expense');
      expect(listRes.statusCode).toBe(400);
      expect(summaryRes.statusCode).toBe(400);
      expect(summaryRes.json<{ error: { code: string } }>().error.code).toBe('validation_error');
    });
  });
});

import { afterAll, describe, expect, it } from 'vitest';
import {
  COUNTABLE,
  EXPENSE_VALUE,
  FROM_TRANSACTIONS,
  INCOME_VALUE,
  INVESTMENT_ROW,
  INVESTMENT_VALUE,
  NET_VALUE,
  rule,
} from '../src/modules/dashboards/rules.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql } from './helpers/db.js';
import { asUser, seedAccount, seedTransactions, type TxSeed } from './helpers/dashboards.js';

afterAll(async () => {
  await cleanupTestUsers();
  await closeAdminSql();
});

const PAST = '2026-01-10T12:00:00Z';
const FUTURE = '2099-01-10T12:00:00Z';

/** One row of each special case, plus plain ones. Expected totals below follow the spec rules. */
const DATASET: TxSeed[] = [
  { type: 'Income', amount: '1000.00', at: PAST, category: 'Salaries' }, // income 1000
  { type: 'Expense', amount: '100.00', at: PAST, category: 'Food' }, // expense 100
  { type: 'Expense', amount: '1.00', at: PAST, category: 'Food', neutral: true }, // neutral: ignored
  { type: 'Income', amount: '2.00', at: PAST, category: 'Salaries', neutral: true }, // neutral: ignored
  { type: 'Expense', amount: '3.00', at: PAST, category: 'Food', method: 'CreditCard' }, // card purchase: ignored
  { type: 'Income', amount: '4.00', at: PAST, category: 'Salaries', method: 'CreditCard' }, // ignored
  { type: 'Expense', amount: '200.00', at: PAST, category: 'Investments' }, // contribution: ignored
  { type: 'Income', amount: '5.00', at: PAST, category: 'Investments' }, // redemption: ignored
  { type: 'Income', amount: '30.00', at: PAST, category: 'Reversal' }, // abates expense by 30
  { type: 'Expense', amount: '20.00', at: PAST, category: 'Reversal' }, // normal expense 20
  { type: 'Expense', amount: '6.00', at: FUTURE, category: 'Food' }, // future: ignored
  { type: 'Income', amount: '7.00', at: FUTURE, category: 'Salaries' }, // future: ignored
  { type: 'Expense', amount: '10.00', at: PAST, category: 'Utilities', method: 'BankTransfer' }, // invoice payment: expense 10
];

async function totals(userId: string): Promise<{ income: string; expense: string; net: string }> {
  const [row] = await asUser(userId, (tx) => tx<{ income: string; expense: string; net: string }[]>`
    select coalesce(sum(${rule(tx, INCOME_VALUE)}), 0.00)::text as income,
           coalesce(sum(${rule(tx, EXPENSE_VALUE)}), 0.00)::text as expense,
           coalesce(sum(${rule(tx, NET_VALUE)}), 0.00)::text as net
    from ${rule(tx, FROM_TRANSACTIONS)}
    where ${rule(tx, COUNTABLE)}`);
  return row as { income: string; expense: string; net: string };
}

async function setup(rows: TxSeed[]) {
  const user = await createTestUser();
  const accountId = await seedAccount(user);
  await seedTransactions(user, accountId, rows);
  return { user, accountId };
}

describe('calculation rules (rules.ts) against Postgres', () => {
  it('yields exactly the spec totals for a dataset with one row of each special case', async () => {
    const { user } = await setup(DATASET);
    // expense: 100 + 20 (Reversal typed Expense) + 10 (invoice payment) - 30 (Reversal Income) = 100
    // income: 1000; net: 1000 - 100 = 900
    expect(await totals(user.id)).toEqual({ income: '1000.00', expense: '100.00', net: '900.00' });
  });

  it('excludes neutral, CreditCard, Investments and future-dated rows from income and expense alike', async () => {
    const ignored: TxSeed[] = DATASET.filter((r) => r.neutral || r.method === 'CreditCard' || r.category === 'Investments' || r.at === FUTURE);
    expect(ignored).toHaveLength(8);
    const { user } = await setup(ignored);
    expect(await totals(user.id)).toEqual({ income: '0.00', expense: '0.00', net: '0.00' });
  });

  it('lets a Reversal Income abate the expense and never count as income', async () => {
    const { user } = await setup([
      { type: 'Expense', amount: '80.00', at: PAST, category: 'Shopping' },
      { type: 'Income', amount: '30.00', at: PAST, category: 'Reversal' },
    ]);
    expect(await totals(user.id)).toEqual({ income: '0.00', expense: '50.00', net: '-50.00' });
  });

  it('treats a Reversal typed Expense as a normal expense', async () => {
    const { user } = await setup([{ type: 'Expense', amount: '20.00', at: PAST, category: 'Reversal' }]);
    expect(await totals(user.id)).toEqual({ income: '0.00', expense: '20.00', net: '-20.00' });
  });

  it('counts a Reversal as positive and an invoice payment as an expense in the net value', async () => {
    const { user } = await setup([
      { type: 'Income', amount: '30.00', at: PAST, category: 'Reversal' },
      { type: 'Expense', amount: '500.00', at: PAST, category: 'Bills', method: 'Boleto', name: 'Pagamento de fatura' },
    ]);
    const { net } = await totals(user.id);
    expect(net).toBe('-470.00');
  });

  it('still counts the transactions of an inactive account', async () => {
    const user = await createTestUser();
    const inactive = await seedAccount(user, 'Antiga', false);
    await seedTransactions(user, inactive, [
      { type: 'Income', amount: '40.00', at: PAST, category: 'Salaries' },
      { type: 'Expense', amount: '15.00', at: PAST, category: 'Food' },
    ]);
    expect(await totals(user.id)).toEqual({ income: '40.00', expense: '15.00', net: '25.00' });
  });

  it('matches categories by key, not by name (a renamed Reversal still abates)', async () => {
    const { user } = await setup([{ type: 'Income', amount: '30.00', at: PAST, category: 'Reversal' }]);
    await getAdminSql()`update public.categories set name = 'Outro nome' where user_id = ${user.id} and key = 'Reversal'`;
    const { expense } = await totals(user.id);
    expect(expense).toBe('-30.00');
  });
});

/** Investments total and the row counts of the three fragments, over every row of the user. */
async function investmentTotals(userId: string) {
  const [row] = await asUser(userId, (tx) => tx<{ investments: string; investmentRows: number; countable: number; both: number }[]>`
    select coalesce(sum(${rule(tx, INVESTMENT_VALUE)}) filter (where ${rule(tx, INVESTMENT_ROW)}), 0.00)::text as investments,
           (count(*) filter (where ${rule(tx, INVESTMENT_ROW)}))::int as "investmentRows",
           (count(*) filter (where ${rule(tx, COUNTABLE)}))::int as countable,
           (count(*) filter (where ${rule(tx, COUNTABLE)} and ${rule(tx, INVESTMENT_ROW)}))::int as both
    from ${rule(tx, FROM_TRANSACTIONS)}`);
  return row as { investments: string; investmentRows: number; countable: number; both: number };
}

describe('investment fragments (rules.ts) against Postgres (TLIST-03, TLIST-04)', () => {
  it('sums an Investments Expense as positive and an Investments Income as negative (200.00 - 5.00)', async () => {
    const { user } = await setup(DATASET);
    expect(await investmentTotals(user.id)).toMatchObject({ investments: '195.00', investmentRows: 2 });
  });

  it('leaves out neutral, CreditCard and future-dated Investments rows and rows of other categories', async () => {
    const { user } = await setup([
      { type: 'Expense', amount: '7.00', at: PAST, category: 'Investments' }, // the only one that counts
      { type: 'Expense', amount: '1.00', at: PAST, category: 'Investments', neutral: true },
      { type: 'Expense', amount: '2.00', at: PAST, category: 'Investments', method: 'CreditCard' },
      { type: 'Expense', amount: '3.00', at: FUTURE, category: 'Investments' },
      { type: 'Income', amount: '4.00', at: FUTURE, category: 'Investments' },
      { type: 'Expense', amount: '5.00', at: PAST, category: 'Food' },
    ]);
    expect(await investmentTotals(user.id)).toMatchObject({ investments: '7.00', investmentRows: 1 });
  });

  it('never makes a row both countable for income and expense and an investment row', async () => {
    const { user } = await setup(DATASET);
    // countable: Salaries 1000, Food 100, Reversal Income 30, Reversal Expense 20, Utilities 10
    expect(await investmentTotals(user.id)).toMatchObject({ countable: 5, investmentRows: 2, both: 0 });
  });

  it('matches Investments by key, not by name (a renamed category still counts)', async () => {
    const { user } = await setup([{ type: 'Expense', amount: '50.00', at: PAST, category: 'Investments' }]);
    await getAdminSql()`update public.categories set name = 'Poupança' where user_id = ${user.id} and key = 'Investments'`;
    expect(await investmentTotals(user.id)).toMatchObject({ investments: '50.00', investmentRows: 1 });
  });
});

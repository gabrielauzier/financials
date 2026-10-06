import { Type, type Static } from '@sinclair/typebox';
import type { PendingQuery, Row, TransactionSql } from 'postgres';
import {
  COUNTABLE,
  EXPENSE_VALUE,
  INCOME_VALUE,
  INVESTMENT_ROW,
  INVESTMENT_VALUE,
  rule,
} from '../dashboards/rules.js';
import { fromJoins } from './schema.js';

const Money = (description: string) =>
  Type.String({ description: `${description}. Decimal string with 2 decimals; may be negative` });

export const SummarySchema = Type.Object({
  count: Type.Integer({
    description: 'Rows that match the filter, all of them (the same as the list total)',
  }),
  income: Money('Income of the filtered rows, with the dashboard rules (no neutral, CreditCard, Investments, Reversal or future-dated rows)'),
  expense: Money('Expense of the filtered rows, with the dashboard rules; an Income in the Reversal category abates it'),
  investments: Money('Net invested in the Investments category (Expense minus Income), outside income, expense and balance'),
  balance: Money('income minus expense'),
});
export type Summary = Static<typeof SummarySchema>;

/**
 * Totals of the rows selected by `where` (the list's WHERE clause). One pass over the filtered set; every
 * sum, the balance and the text conversion happen in the database, so no money value becomes a JS number.
 * The calculation rules come from rules.ts (AD-003); nothing here decides what counts.
 */
export async function summaryTotals(tx: TransactionSql, where: PendingQuery<Row[]>): Promise<Summary> {
  const [row] = await tx<Summary[]>`
    select count,
           income::text as income,
           expense::text as expense,
           investments::text as investments,
           (income - expense)::text as balance
    from (
      select count(*)::int as count,
             coalesce(sum(${rule(tx, INCOME_VALUE)}) filter (where ${rule(tx, COUNTABLE)}), 0.00)::numeric(20,2) as income,
             coalesce(sum(${rule(tx, EXPENSE_VALUE)}) filter (where ${rule(tx, COUNTABLE)}), 0.00)::numeric(20,2) as expense,
             coalesce(sum(${rule(tx, INVESTMENT_VALUE)}) filter (where ${rule(tx, INVESTMENT_ROW)}), 0.00)::numeric(20,2) as investments
      from ${fromJoins(tx)}
      ${where}
    ) totals`;
  return row as Summary;
}

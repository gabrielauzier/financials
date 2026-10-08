/**
 * The calculation rules of every dashboard (AD-003). This is the ONLY file that knows how neutral,
 * CreditCard, Investments, Reversal and future-dated rows are treated; the queries just embed these
 * fragments. Categories are matched by `c.key`, never by name.
 *
 * Aliases: `t` = public.transactions, `c` = public.categories (see FROM_TRANSACTIONS).
 * Fragments are static strings with no user input, so embedding them with `tx.unsafe` is safe.
 */
import type { TransactionSql } from 'postgres';

/** The row source every dashboard aggregates over. */
export const FROM_TRANSACTIONS = `
  public.transactions t
  join public.categories c on c.id = t.category_id and c.user_id = t.user_id`;

/**
 * Rows that may count in any total: not neutral, not paid by card (the invoice payment is the Expense
 * on the account statement) and not dated after now. Investments is split off by COUNTABLE and
 * INVESTMENT_ROW.
 */
export const COUNTABLE_BASE = `(
  NOT t.neutral
  AND t.payment_method <> 'CreditCard'
  AND t.occurred_at <= now()
)`;

/** Rows that count in income and expense: the base rows that are not an Investments contribution. */
export const COUNTABLE = `(
  ${COUNTABLE_BASE}
  AND c.key <> 'Investments'
)`;

/**
 * Rows of the Investments category that count in the separate investments total of the extrato summary:
 * the same exclusions as the dashboard (neutral, CreditCard, future-dated), never part of income or expense.
 */
export const INVESTMENT_ROW = `(
  ${COUNTABLE_BASE}
  AND c.key = 'Investments'
)`;

/** Amount of an investment row: a contribution (Expense) is positive, a redemption (Income) negative. */
export const INVESTMENT_VALUE = `(CASE WHEN t.type = 'Expense' THEN t.amount ELSE -t.amount END)`;

/**
 * Expense of a countable row: an Expense counts in full; an Income in the Reversal category abates
 * the expense (negative); any other Income is not an expense. A Reversal typed Expense is a normal expense.
 */
export const EXPENSE_VALUE = `(
  CASE
    WHEN t.type = 'Expense' THEN t.amount
    WHEN t.type = 'Income' AND c.key = 'Reversal' THEN -t.amount
    ELSE 0.00
  END
)`;

/** Rows typed Expense (a Reversal Income is not one); used by the expense search, always together with COUNTABLE. */
export const EXPENSE_ROW = `(t.type = 'Expense')`;

/** Income of a countable row: Incomes other than Reversal. */
export const INCOME_VALUE = `(
  CASE WHEN t.type = 'Income' AND c.key <> 'Reversal' THEN t.amount ELSE 0.00 END
)`;

/** Net-worth contribution of a countable row (a Reversal is positive, an invoice payment negative). */
export const NET_VALUE = `(${INCOME_VALUE} - ${EXPENSE_VALUE})`;

/**
 * CreditCard purchases for the card view: never part of the totals, but shown whether or not they
 * are neutral, as long as they are not dated after now.
 */
export const CARD_PURCHASE = `(
  t.payment_method = 'CreditCard'
  AND t.occurred_at <= now()
)`;

/** Amount of a card row in the card view: purchases (Expense) positive, refunds (Income) negative. */
export const CARD_VALUE = `(CASE WHEN t.type = 'Expense' THEN t.amount ELSE -t.amount END)`;

/** Open credit expenses (cards' installments and subscriptions) that still have a balance to show. */
export const OPEN_CREDIT_EXPENSE = `ce.status IN ('Active', 'Once', 'ToCancel')`;

/** Wraps a fragment for use inside a postgres.js template: `tx\`... ${rule(tx, COUNTABLE)}\``. */
export function rule(tx: TransactionSql, fragment: string) {
  return tx.unsafe(fragment);
}

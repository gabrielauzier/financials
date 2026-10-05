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
 * Rows that may count at all: not neutral, not paid by card (the invoice payment is the Expense on
 * the account statement), not an Investments contribution, and not dated after now.
 */
export const COUNTABLE = `(
  NOT t.neutral
  AND t.payment_method <> 'CreditCard'
  AND c.key <> 'Investments'
  AND t.occurred_at <= now()
)`;

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

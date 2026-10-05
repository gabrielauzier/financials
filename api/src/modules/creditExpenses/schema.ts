import { Type, type Static } from '@sinclair/typebox';
import type { TransactionSql } from 'postgres';

export const STATUSES = ['Once', 'Active', 'Inactive', 'Canceled', 'ToCancel'] as const;
export type CreditExpenseStatus = (typeof STATUSES)[number];

const nullableString = Type.Union([Type.String(), Type.Null()]);

export const CreditExpenseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  accountId: Type.String({ format: 'uuid' }),
  categoryId: Type.String({ format: 'uuid' }),
  categoryName: Type.String(),
  name: Type.String(),
  totalAmount: Type.String({ description: 'Positive decimal string with 2 decimals, e.g. "600.00"' }),
  paidAmount: Type.String({ description: 'Decimal string with 2 decimals, between 0.00 and totalAmount' }),
  remainingAmount: Type.String({ description: 'totalAmount minus paidAmount, computed by the database, 2 decimals' }),
  occurredAt: Type.String({ format: 'date-time', description: 'ISO-8601 instant in UTC' }),
  recurrencyDay: Type.Integer({ minimum: 1, maximum: 31 }),
  status: Type.Unsafe<CreditExpenseStatus>({ type: 'string', enum: [...STATUSES] }),
  notes: nullableString,
});
export type CreditExpense = Static<typeof CreditExpenseSchema>;

export interface CreditExpenseRow {
  id: string;
  account_id: string;
  category_id: string;
  category_name: string;
  name: string;
  total_amount: string;
  paid_amount: string;
  remaining_amount: string;
  occurred_at: Date;
  recurrency_day: number;
  status: CreditExpenseStatus;
  notes: string | null;
}

/**
 * Columns plus the joined category name; the FROM clause must alias `public.credit_expenses ce`
 * and categories `c`. Amounts are read as text (never parsed to a JS number) and the remaining
 * amount is subtracted by the database in numeric(14,2), so it is always a canonical 2-decimal string.
 */
export const selectColumns = (tx: TransactionSql) => tx`
  ce.id, ce.account_id, ce.category_id, c.name as category_name, ce.name,
  ce.total_amount::text as total_amount, ce.paid_amount::text as paid_amount,
  (ce.total_amount - ce.paid_amount)::text as remaining_amount,
  ce.occurred_at, ce.recurrency_day, ce.status, ce.notes`;

export const fromJoins = (tx: TransactionSql) => tx`
  public.credit_expenses ce
  join public.categories c on c.id = ce.category_id and c.user_id = ce.user_id`;

export function toCreditExpense(row: CreditExpenseRow): CreditExpense {
  return {
    id: row.id,
    accountId: row.account_id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    name: row.name,
    totalAmount: row.total_amount,
    paidAmount: row.paid_amount,
    remainingAmount: row.remaining_amount,
    occurredAt: row.occurred_at.toISOString(),
    recurrencyDay: row.recurrency_day,
    status: row.status,
    notes: row.notes,
  };
}

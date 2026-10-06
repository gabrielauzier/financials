import { Type, type Static } from '@sinclair/typebox';
import type { TransactionSql } from 'postgres';

export const TYPES = ['Income', 'Expense'] as const;
export const PAYMENT_METHODS = ['BankTransfer', 'Boleto', 'Cash', 'CreditCard', 'DebitCard', 'NuPay', 'PIX', 'Other'] as const;

export type TransactionType = (typeof TYPES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const nullableString = Type.Union([Type.String(), Type.Null()]);

export const TransactionSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  accountId: Type.String({ format: 'uuid' }),
  accountNickname: Type.String(),
  categoryId: Type.String({ format: 'uuid' }),
  categoryName: Type.String(),
  name: Type.String(),
  type: Type.Unsafe<TransactionType>({ type: 'string', enum: [...TYPES] }),
  occurredAt: Type.String({ format: 'date-time', description: 'ISO-8601 instant in UTC' }),
  amount: Type.String({ description: 'Positive decimal string with 2 decimals, e.g. "1234.56"' }),
  paymentMethod: Type.Unsafe<PaymentMethod>({ type: 'string', enum: [...PAYMENT_METHODS] }),
  notes: nullableString,
  receipt: nullableString,
  description: Type.Union([Type.String(), Type.Null()], {
    description: 'Original title of the transaction (e.g. from the bank statement); read-only after creation',
  }),
  neutral: Type.Boolean(),
  counterpartyDocument: nullableString,
  counterpartyBank: nullableString,
});
export type Transaction = Static<typeof TransactionSchema>;

export interface TransactionRow {
  id: string;
  account_id: string;
  account_nickname: string;
  category_id: string;
  category_name: string;
  name: string;
  type: TransactionType;
  occurred_at: Date;
  amount: string;
  payment_method: PaymentMethod;
  notes: string | null;
  receipt: string | null;
  description: string | null;
  neutral: boolean;
  counterparty_document: string | null;
  counterparty_bank: string | null;
}

/** Columns plus joined names; the FROM clause must alias `public.transactions t`, accounts `a`, categories `c`. */
export const selectColumns = (tx: TransactionSql) => tx`
  t.id, t.account_id, a.nickname as account_nickname, t.category_id, c.name as category_name,
  t.name, t.type, t.occurred_at, t.amount, t.payment_method, t.notes, t.receipt, t.description, t.neutral,
  t.counterparty_document, t.counterparty_bank`;

export const fromJoins = (tx: TransactionSql) => tx`
  public.transactions t
  join public.accounts a on a.id = t.account_id and a.user_id = t.user_id
  join public.categories c on c.id = t.category_id and c.user_id = t.user_id`;

export function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    accountId: row.account_id,
    accountNickname: row.account_nickname,
    categoryId: row.category_id,
    categoryName: row.category_name,
    name: row.name,
    type: row.type,
    occurredAt: row.occurred_at.toISOString(),
    amount: row.amount,
    paymentMethod: row.payment_method,
    notes: row.notes,
    receipt: row.receipt,
    description: row.description,
    neutral: row.neutral,
    counterpartyDocument: row.counterparty_document,
    counterpartyBank: row.counterparty_bank,
  };
}

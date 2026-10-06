import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { TransactionSql } from 'postgres';
import { AppError } from '../../plugins/errors.js';
import { PAYMENT_METHODS } from '../transactions/schema.js';
import { classify } from './classify.js';
import { parseImport } from './formats.js';
import type { ClassifiedRow, RowStatus } from './types.js';

const STATUSES: readonly RowStatus[] = ['new', 'duplicate', 'ignored', 'unrecognized', 'invalid'];

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const nullableString = Type.Union([Type.String(), Type.Null()]);
const stringEnum = <T extends string>(values: readonly T[]) => Type.Unsafe<T>({ type: 'string', enum: [...values] });

export const PreviewRowSchema = Type.Object({
  index: Type.Integer({ description: '0-based data row of the file; the selection key' }),
  localDate: Type.String({ description: 'YYYY-MM-DD' }),
  type: stringEnum(['Income', 'Expense'] as const),
  amount: Type.String({ description: 'Decimal string, e.g. "1234.56"' }),
  name: Type.String(),
  paymentMethod: stringEnum(PAYMENT_METHODS),
  categoryName: Type.String(),
  status: stringEnum(STATUSES),
  neutral: Type.Boolean(),
  reason: Type.Optional(Type.String()),
  counterpartyDocument: nullableString,
  counterpartyBank: nullableString,
});
export type PreviewRow = Static<typeof PreviewRowSchema>;

export const PreviewSchema = Type.Object({
  rows: Type.Array(PreviewRowSchema),
  totals: Type.Object({
    new: Type.Integer(),
    duplicate: Type.Integer(),
    ignored: Type.Integer(),
    unrecognized: Type.Integer(),
    invalid: Type.Integer(),
  }),
});
export type Preview = Static<typeof PreviewSchema>;

export function invalidAccount(): AppError {
  return new AppError('invalid_account', 422, 'Select an active account', 'accountId');
}

export interface Analysis {
  account: { id: string; bank: string };
  rows: ClassifiedRow[];
}

/**
 * Parses and classifies the file for an active account of the user, inside the caller's `withUser`
 * transaction. Reads only: nothing is written.
 */
export async function analyze(tx: TransactionSql, accountId: string, content: Buffer, tz: string): Promise<Analysis> {
  // RLS hides other users' accounts, so "not visible" covers inactive, foreign and missing.
  const [account] = UUID.test(accountId)
    ? await tx<{ id: string; bank: string }[]>`select id, bank from public.accounts where id = ${accountId} and active`
    : [];
  if (!account) throw invalidAccount();
  const { rows } = parseImport(content.toString('utf8'), account.bank);
  return { account, rows: await classify(tx, rows, account.id, tz) };
}

export interface Category {
  id: string;
  name: string;
}

/** The user's categories for the rows' keys (system categories, which always exist). */
export async function categoriesByKey(tx: TransactionSql, rows: ClassifiedRow[]): Promise<Map<string, Category>> {
  const keys = [...new Set(rows.map((r) => r.categoryKey))];
  const found = await tx<{ key: string; id: string; name: string }[]>`
    select key, id, name from public.categories where key = any(${keys}::text[])`;
  const byKey = new Map(found.map((c) => [c.key, { id: c.id, name: c.name }]));
  for (const key of keys) {
    if (!byKey.has(key)) throw new Error(`System category ${key} is missing for this user`);
  }
  return byKey;
}

export function toPreview(rows: ClassifiedRow[], categories: Map<string, Category>): Preview {
  const totals = { new: 0, duplicate: 0, ignored: 0, unrecognized: 0, invalid: 0 };
  const previewRows = rows.map((row): PreviewRow => {
    totals[row.status] += 1;
    const categoryName = (categories.get(row.categoryKey) as Category).name;
    return {
      index: row.index,
      localDate: row.localDate,
      type: row.type,
      amount: row.amount,
      name: row.name,
      paymentMethod: row.paymentMethod,
      categoryName,
      status: row.status,
      neutral: row.neutral,
      ...(row.reason === undefined ? {} : { reason: row.reason }),
      counterpartyDocument: row.counterpartyDocument,
      counterpartyBank: row.counterpartyBank,
    };
  });
  return { rows: previewRows, totals };
}

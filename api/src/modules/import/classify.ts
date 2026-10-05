import type { TransactionSql } from 'postgres';
import type { ClassifiedRow, ParsedRow, RowStatus } from './types.js';

/** Only importable rows can become `duplicate`; `ignored` and `invalid` rows are never touched. */
const DEDUPABLE: ReadonlySet<RowStatus> = new Set(['new', 'unrecognized']);

const dedupable = (row: ParsedRow): boolean => DEDUPABLE.has(row.status);

/** Identifiers of the given set that already exist on the account (one query; RLS-scoped by `tx`). */
async function existingIdentifiers(tx: TransactionSql, accountId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const found = await tx<{ identifier: string }[]>`
    select distinct identifier from public.transactions
    where account_id = ${accountId} and identifier = any(${ids}::text[])`;
  return new Set(found.map((r) => r.identifier));
}

/**
 * Marks importable rows as `duplicate` (IMP-06):
 *  - with `identifier`: it already exists on the same account, or an earlier importable row of the
 *    file has it (an `invalid`/`ignored` row never counts as the first occurrence).
 * A row that is both `unrecognized` and a duplicate becomes `duplicate` and keeps its `reason`.
 * `tx` must be a `withUser` transaction so every read is limited to the user's rows.
 */
export async function classify(
  tx: TransactionSql,
  rows: ParsedRow[],
  accountId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the dedup without identifier uses it
  tz: string,
): Promise<ClassifiedRow[]> {
  const ids = [...new Set(rows.filter(dedupable).flatMap((r) => (r.identifier === null ? [] : [r.identifier])))];
  const existing = await existingIdentifiers(tx, accountId, ids);
  const seen = new Set<string>();

  return rows.map((row) => {
    if (!dedupable(row) || row.identifier === null) return { ...row, neutral: false };
    const duplicate = existing.has(row.identifier) || seen.has(row.identifier);
    seen.add(row.identifier);
    return { ...row, status: duplicate ? 'duplicate' : row.status, neutral: false };
  });
}

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
 * Positions (in `rows`) of the rows matching an existing transaction of the account by exact `name`
 * (case- and accent-sensitive string equality; parsers already collapse spaces), local day in `tz`,
 * numeric `amount` and `type`. One query for all rows.
 */
async function matchingByContent(
  tx: TransactionSql,
  accountId: string,
  tz: string,
  rows: { position: number; row: ParsedRow }[],
): Promise<Set<number>> {
  if (rows.length === 0) return new Set();
  const found = await tx<{ position: number }[]>`
    select r.position
    from unnest(
      ${rows.map((r) => r.position)}::int[],
      ${rows.map((r) => r.row.name)}::text[],
      ${rows.map((r) => r.row.localDate)}::date[],
      ${rows.map((r) => r.row.amount)}::numeric[],
      ${rows.map((r) => r.row.type)}::text[]
    ) as r (position, name, day, amount, type)
    where exists (
      select 1 from public.transactions t
      where t.account_id = ${accountId}
        and t.name = r.name
        and t.type = r.type
        and t.amount = r.amount
        and (t.occurred_at at time zone ${tz})::date = r.day)`;
  return new Set(found.map((r) => r.position));
}

/**
 * Marks importable rows as `duplicate` (IMP-06):
 *  - with `identifier`: it already exists on the same account, or an earlier importable row of the
 *    file has it (an `invalid`/`ignored` row never counts as the first occurrence);
 *  - without `identifier`: an existing transaction of the account has the same name, local day
 *    (in `tz`), amount and type. Rows of the file are not compared with each other, so identical
 *    rows of a first import are all kept.
 * A row that is both `unrecognized` and a duplicate becomes `duplicate` and keeps its `reason`.
 * `tx` must be a `withUser` transaction so every read is limited to the user's rows.
 */
export async function classify(
  tx: TransactionSql,
  rows: ParsedRow[],
  accountId: string,
  tz: string,
): Promise<ClassifiedRow[]> {
  const ids = [...new Set(rows.filter(dedupable).flatMap((r) => (r.identifier === null ? [] : [r.identifier])))];
  const existing = await existingIdentifiers(tx, accountId, ids);
  const withoutId = rows.flatMap((row, position) =>
    dedupable(row) && row.identifier === null ? [{ position, row }] : [],
  );
  const matched = await matchingByContent(tx, accountId, tz, withoutId);
  const seen = new Set<string>();

  return rows.map((row, position) => {
    if (!dedupable(row)) return { ...row, neutral: false };
    if (row.identifier === null) {
      return { ...row, status: matched.has(position) ? 'duplicate' : row.status, neutral: false };
    }
    const duplicate = existing.has(row.identifier) || seen.has(row.identifier);
    seen.add(row.identifier);
    return { ...row, status: duplicate ? 'duplicate' : row.status, neutral: false };
  });
}

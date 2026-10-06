import type { Sql, TransactionSql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { closeAdminSql, getAdminSql } from './helpers/db.js';

afterAll(async () => {
  await closeAdminSql();
});

interface TableSecurity {
  table: string;
  rls: boolean;
  policies: number;
}

/**
 * Security state of every user-data table in `public`: tables with a `user_id` column, plus
 * `profiles` (keyed by `id`). New tables from later migrations are picked up automatically.
 */
async function userDataTables(sql: Sql | TransactionSql): Promise<TableSecurity[]> {
  return sql<TableSecurity[]>`
    select c.relname::text as table,
           c.relrowsecurity as rls,
           (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and (c.relname = 'profiles' or exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped))
    order by c.relname`;
}

const violations = (tables: TableSecurity[]) =>
  tables.filter((t) => !t.rls || t.policies < 1).map((t) => t.table);

class Rollback extends Error {}

/** Runs `fn` in a transaction that is always rolled back. */
async function inRolledBackTransaction(fn: (tx: TransactionSql) => Promise<void>): Promise<void> {
  await getAdminSql()
    .begin(async (tx) => {
      await fn(tx);
      throw new Rollback();
    })
    .catch((error: unknown) => {
      if (!(error instanceof Rollback)) throw error;
    });
}

describe('RLS catalog', () => {
  it('every user-data table in public has RLS enabled and at least one policy', async () => {
    const tables = await userDataTables(getAdminSql());

    const profiles = tables.find((t) => t.table === 'profiles');
    expect(profiles?.rls).toBe(true);
    expect(profiles?.policies).toBeGreaterThanOrEqual(1);
    expect(violations(tables)).toEqual([]);
  });

  it('flags a user_id table without RLS or without policies (proof inside a rolled-back transaction)', async () => {
    await inRolledBackTransaction(async (tx) => {
      await tx`create table public.rls_probe_no_rls (id int, user_id uuid)`;
      await tx`create table public.rls_probe_no_policy (id int, user_id uuid)`;
      await tx`alter table public.rls_probe_no_policy enable row level security`;

      expect(violations(await userDataTables(tx))).toEqual(['rls_probe_no_policy', 'rls_probe_no_rls']);
    });

    const [left] = await getAdminSql()`select to_regclass('public.rls_probe_no_rls') as t`;
    expect(left?.t).toBeNull();
  });
});

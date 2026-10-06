import { readFileSync } from 'node:fs';
import type { TransactionSql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { COLOR_KEYS } from '../src/lib/palette.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql } from './helpers/db.js';

afterAll(async () => {
  await cleanupTestUsers();
  await closeAdminSql();
});

const MIGRATION = readFileSync(new URL('../../supabase/migrations/0008_colors.sql', import.meta.url), 'utf8');
const BACKFILL = MIGRATION.slice(
  MIGRATION.indexOf('-- backfill:begin'),
  MIGRATION.indexOf('-- backfill:end'),
);

/** The design table "Tabela de cores semeadas": key -> color. */
const SEEDED_COLORS: Record<string, string> = {
  Entertainment: 'purple-600',
  Food: 'orange-600',
  Salaries: 'emerald-600',
  Healthcare: 'rose-600',
  Utilities: 'sky-600',
  Unknown: 'zinc-400',
  Transport: 'blue-600',
  Help: 'pink-600',
  PJ: 'indigo-600',
  Bills: 'amber-600',
  Emergency: 'red-600',
  Uncategorized: 'slate-400',
  Wishes: 'fuchsia-600',
  Reversal: 'teal-600',
  Shopping: 'lime-600',
  Pets: 'yellow-600',
  Investments: 'green-900',
};

const BANK_COLORS: Record<string, string> = {
  Nubank: 'purple-600',
  SofisaDireto: 'teal-600',
  Neon: 'sky-600',
  XP: 'zinc-900',
  Other: 'slate-600',
};

class Rollback extends Error {}

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

async function asUser<T>(userId: string, fn: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return getAdminSql().begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated' })}, true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  }) as Promise<T>;
}

const colorsOf = (userId: string) =>
  getAdminSql()<{ key: string; name: string; is_system: boolean; color: string }[]>`
    select key, name, is_system, color from public.categories where user_id = ${userId} order by key`;

describe('colors migration', () => {
  it('keeps the SQL domain list equal to COLOR_KEYS', async () => {
    const rows = await getAdminSql()<{ def: string }[]>`
      select pg_get_constraintdef(c.oid) as def
      from pg_constraint c
      join pg_type t on t.oid = c.contypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'palette_color'`;
    expect(rows).toHaveLength(1);
    const keys = [...(rows[0]?.def ?? '').matchAll(/'([a-z]+-\d+)'/g)].map((m) => m[1]);
    expect([...keys].sort()).toEqual([...COLOR_KEYS].sort());
    expect(new Set(keys).size).toBe(66);
  });

  it.each(['categories', 'accounts'])('declares %s.color not null, of the palette domain, default slate-600', async (table) => {
    const [col] = await getAdminSql()<
      { is_nullable: string; domain_name: string | null; column_default: string | null }[]
    >`select is_nullable, domain_name, column_default from information_schema.columns
      where table_schema = 'public' and table_name = ${table} and column_name = 'color'`;
    expect(col?.is_nullable).toBe('NO');
    expect(col?.domain_name).toBe('palette_color');
    expect(col?.column_default).toContain("'slate-600'");
  });

  it('rejects a color outside the palette in both tables with SQLSTATE 23514', async () => {
    const user = await createTestUser();
    await expect(
      getAdminSql()`insert into public.categories (user_id, name, color) values (${user.id}, 'Fora', 'blue-500')`,
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      getAdminSql()`insert into public.accounts (user_id, bank, nickname, holder_names, color)
        values (${user.id}, 'Nubank', 'Fora', ${['A']}, 'blue-500')`,
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      getAdminSql()`update public.categories set color = 'Blue-600' where user_id = ${user.id} and key = 'Food'`,
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('defaults new user rows to slate-600', async () => {
    const user = await createTestUser();
    await getAdminSql()`insert into public.categories (user_id, name) values (${user.id}, 'Minha')`;
    await getAdminSql()`insert into public.accounts (user_id, bank, nickname, holder_names)
      values (${user.id}, 'Other', 'Padrão', ${['A']})`;
    const [cat] = await getAdminSql()`select color from public.categories where user_id = ${user.id} and name = 'Minha'`;
    const [acc] = await getAdminSql()`select color from public.accounts where user_id = ${user.id}`;
    expect(cat?.color).toBe('slate-600');
    expect(acc?.color).toBe('slate-600');
  });

  it('runs the backfill block: seeded categories get the 17 design colors, user ones and bank accounts as designed', async () => {
    expect(BACKFILL.length).toBeGreaterThan(100);
    const user = await createTestUser();
    await getAdminSql()`insert into public.categories (user_id, name) values (${user.id}, 'Minha')`;
    for (const bank of Object.keys(BANK_COLORS)) {
      await getAdminSql()`insert into public.accounts (user_id, bank, nickname, holder_names)
        values (${user.id}, ${bank}, ${`Conta ${bank}`}, ${['A']})`;
    }
    await getAdminSql()`update public.categories set color = 'slate-600' where user_id = ${user.id}`;
    await getAdminSql()`update public.accounts set color = 'slate-600' where user_id = ${user.id}`;

    await getAdminSql().unsafe(BACKFILL);

    const cats = await colorsOf(user.id);
    const seeded = cats.filter((c) => c.key !== null);
    expect(seeded).toHaveLength(17);
    expect(Object.fromEntries(seeded.map((c) => [c.key, c.color]))).toEqual(SEEDED_COLORS);
    expect(new Set(seeded.map((c) => c.color)).size).toBe(17);
    expect(cats.find((c) => c.name === 'Minha')?.color).toBe('slate-600');

    const accounts = await getAdminSql()<{ bank: string; color: string }[]>`
      select bank, color from public.accounts where user_id = ${user.id}`;
    expect(Object.fromEntries(accounts.map((a) => [a.bank, a.color]))).toEqual(BANK_COLORS);
  });

  it('applies to existing rows without losing data', async () => {
    const user = await createTestUser();
    await getAdminSql()`insert into public.categories (user_id, name) values (${user.id}, 'Minha')`;
    await getAdminSql()`insert into public.accounts (user_id, bank, nickname, holder_names)
      values (${user.id}, 'Nubank', 'Principal', ${['Ana', 'Beto']})`;
    const before = await getAdminSql()`
      select id, key, name, is_system from public.categories where user_id = ${user.id} order by id`;
    const accountsBefore = await getAdminSql()`
      select id, bank, nickname, holder_names, active from public.accounts where user_id = ${user.id}`;

    await inRolledBackTransaction(async (tx) => {
      // Return to the pre-0008 shape, then run the whole migration file over rows that already exist.
      await tx`alter table public.categories drop column color`;
      await tx`alter table public.accounts drop column color`;
      await tx`drop domain public.palette_color`;
      await tx.unsafe(MIGRATION);

      const after = await tx`
        select id, key, name, is_system from public.categories where user_id = ${user.id} order by id`;
      expect(after).toEqual(before);
      const accountsAfter = await tx`
        select id, bank, nickname, holder_names, active from public.accounts where user_id = ${user.id}`;
      expect(accountsAfter).toEqual(accountsBefore);
      const colored = await tx<{ key: string | null; color: string }[]>`
        select key, color from public.categories where user_id = ${user.id}`;
      expect(colored.find((c) => c.key === 'Food')?.color).toBe('orange-600');
      expect(colored.find((c) => c.key === null)?.color).toBe('slate-600');
      // A distinct statement text avoids the driver's cached plan from before the column was recreated.
      const [account] = await tx`select color as after_color from public.accounts where user_id = ${user.id}`;
      expect(account?.after_color).toBe('purple-600');
    });
  });

  it('gives a new user the 17 categories with the design colors through the signup path', async () => {
    const user = await createTestUser();
    const rows = await colorsOf(user.id);
    expect(rows).toHaveLength(17);
    expect(Object.fromEntries(rows.map((r) => [r.key, r.color]))).toEqual(SEEDED_COLORS);
    expect(new Set(rows.map((r) => r.color)).size).toBe(17);
    expect(rows.filter((r) => r.is_system).map((r) => r.key).sort()).toEqual([
      'Investments',
      'Reversal',
      'Uncategorized',
    ]);
    expect(rows.find((r) => r.key === 'Help')?.name).toBe('Ajuda (a terceiros)');
  });

  it('adds nothing when seed_categories runs twice and keeps it closed to authenticated and anon', async () => {
    const user = await createTestUser();
    await getAdminSql()`select public.seed_categories(${user.id}::uuid)`;
    await getAdminSql()`select public.seed_categories(${user.id}::uuid)`;
    expect(await colorsOf(user.id)).toHaveLength(17);
    const [priv] = await getAdminSql()`
      select has_function_privilege('authenticated', 'public.seed_categories(uuid)', 'execute') as a,
             has_function_privilege('anon', 'public.seed_categories(uuid)', 'execute') as n`;
    expect(priv).toEqual({ a: false, n: false });
    await expect(
      asUser(user.id, (tx) => tx`select public.seed_categories(${user.id}::uuid)`),
    ).rejects.toThrow(/permission denied/);
  });

  it('keeps RLS: user B cannot read or update the colors of user A, and system categories stay locked', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await asUser(a.id, (tx) => tx`insert into public.accounts (bank, nickname, holder_names, color)
      values ('XP', 'Conta A', ${['A']}, 'teal-400')`);

    const seenByB = await asUser(b.id, (tx) => tx`select color from public.accounts`);
    expect(seenByB).toHaveLength(0);
    const bCategories = await asUser(b.id, (tx) => tx<{ user_id: string }[]>`select user_id from public.categories`);
    expect(bCategories.every((c) => c.user_id === b.id)).toBe(true);
    const upAccount = await asUser(b.id, (tx) => tx`update public.accounts set color = 'red-400' where user_id = ${a.id}`);
    expect(upAccount.count).toBe(0);
    const upCategory = await asUser(b.id, (tx) => tx`update public.categories set color = 'red-400' where user_id = ${a.id}`);
    expect(upCategory.count).toBe(0);
    const [stored] = await getAdminSql()`select color from public.accounts where user_id = ${a.id}`;
    expect(stored?.color).toBe('teal-400');

    const system = await asUser(a.id, (tx) => tx`update public.categories set color = 'red-400' where key = 'Uncategorized'`);
    expect(system.count).toBe(0);
    const regular = await asUser(a.id, (tx) => tx`update public.categories set color = 'red-400' where key = 'Food'`);
    expect(regular.count).toBe(1);
  });
});

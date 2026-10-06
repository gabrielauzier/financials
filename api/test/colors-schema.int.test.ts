import { readFileSync } from 'node:fs';
import type { TransactionSql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { COLOR_KEYS } from '../src/lib/palette.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql } from './helpers/db.js';

afterAll(async () => {
  await cleanupTestUsers();
  await closeAdminSql();
});

const migrationFile = (name: string) =>
  readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const MIGRATION_0008 = migrationFile('0008_colors.sql');
const MIGRATION_0009 = migrationFile('0009_palette_400.sql');
const REMAP = MIGRATION_0009.slice(
  MIGRATION_0009.indexOf('-- remap:begin'),
  MIGRATION_0009.indexOf('-- remap:end'),
);

/** The design table "Tabela de cores semeadas": key -> color (all shade 400, 17 distinct families). */
const SEEDED_COLORS: Record<string, string> = {
  Entertainment: 'purple-400',
  Food: 'orange-400',
  Salaries: 'emerald-400',
  Healthcare: 'rose-400',
  Utilities: 'sky-400',
  Unknown: 'zinc-400',
  Transport: 'blue-400',
  Help: 'pink-400',
  PJ: 'indigo-400',
  Bills: 'amber-400',
  Emergency: 'red-400',
  Uncategorized: 'slate-400',
  Wishes: 'fuchsia-400',
  Reversal: 'teal-400',
  Shopping: 'lime-400',
  Pets: 'yellow-400',
  Investments: 'green-400',
};

const BANK_COLORS: Record<string, string> = {
  Nubank: 'purple-400',
  SofisaDireto: 'teal-400',
  Neon: 'sky-400',
  XP: 'zinc-400',
  Other: 'slate-400',
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

/**
 * Returns the two tables to their pre-0008 shape and replays the migration FILES inside the
 * surrounding transaction (0008, then 0009 unless `stopAt0008`), so every assertion reads what the
 * files create and not what a possibly stale local database already holds. Callers use
 * `inRolledBackTransaction`, so nothing persists and db reset is never needed.
 */
async function replayMigrations(tx: TransactionSql, options: { stopAt0008?: boolean } = {}): Promise<void> {
  await tx`alter table public.categories drop column color`;
  await tx`alter table public.accounts drop column color`;
  await tx`drop domain public.palette_color`;
  await tx.unsafe(MIGRATION_0008);
  if (!options.stopAt0008) await tx.unsafe(MIGRATION_0009);
}

describe('palette 400 migration (the files, replayed in a rolled-back transaction)', () => {
  it('keeps the SQL domain list equal to COLOR_KEYS', async () => {
    await inRolledBackTransaction(async (tx) => {
      await replayMigrations(tx);
      const rows = await tx<{ def: string }[]>`
        select pg_get_constraintdef(c.oid) as def
        from pg_constraint c
        join pg_type t on t.oid = c.contypid
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = 'palette_color'`;
      expect(rows).toHaveLength(1);
      const keys = [...(rows[0]?.def ?? '').matchAll(/'([a-z]+-\d+)'/g)].map((m) => m[1]);
      expect([...keys].sort()).toEqual([...COLOR_KEYS].sort());
      expect(new Set(keys).size).toBe(22);
      expect(keys.every((key) => key?.endsWith('-400'))).toBe(true);
    });
  });

  it('declares categories.color and accounts.color not null, of the palette domain, default slate-400', async () => {
    await inRolledBackTransaction(async (tx) => {
      await replayMigrations(tx);
      for (const table of ['categories', 'accounts']) {
        const [col] = await tx<
          { is_nullable: string; domain_name: string | null; column_default: string | null }[]
        >`select is_nullable, domain_name, column_default from information_schema.columns
          where table_schema = 'public' and table_name = ${table} and column_name = 'color'`;
        expect(col?.is_nullable, `${table}.is_nullable`).toBe('NO');
        expect(col?.domain_name, `${table}.domain_name`).toBe('palette_color');
        expect(col?.column_default, `${table}.column_default`).toContain("'slate-400'");
      }
    });
  });

  it('rejects a color outside the palette in both tables with SQLSTATE 23514', async () => {
    const user = await createTestUser();
    await inRolledBackTransaction(async (tx) => {
      await replayMigrations(tx);
      await expect(
        tx.savepoint((sp) => sp`insert into public.categories (user_id, name, color) values (${user.id}, 'Fora', 'blue-500')`),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        tx.savepoint((sp) => sp`insert into public.categories (user_id, name, color) values (${user.id}, 'Fora', 'blue-600')`),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        tx.savepoint(
          (sp) => sp`insert into public.accounts (user_id, bank, nickname, holder_names, color)
            values (${user.id}, 'Nubank', 'Fora', ${['A']}, 'blue-500')`,
        ),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        tx.savepoint((sp) => sp`update public.categories set color = 'Blue-400' where user_id = ${user.id} and key = 'Food'`),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('defaults new user rows to slate-400', async () => {
    const user = await createTestUser();
    await inRolledBackTransaction(async (tx) => {
      await replayMigrations(tx);
      await tx`insert into public.categories (user_id, name) values (${user.id}, 'Minha')`;
      await tx`insert into public.accounts (user_id, bank, nickname, holder_names)
        values (${user.id}, 'Other', 'Padrão', ${['A']})`;
      const [cat] = await tx`select color from public.categories where user_id = ${user.id} and name = 'Minha'`;
      const [acc] = await tx`select color as account_color from public.accounts where user_id = ${user.id} and nickname = 'Padrão'`;
      expect(cat?.color).toBe('slate-400');
      expect(acc?.account_color).toBe('slate-400');
    });
  });

  it('seed_categories from the file gives the 17 design colors, system flags and names, idempotently, closed to authenticated and anon', async () => {
    const user = await createTestUser();
    await inRolledBackTransaction(async (tx) => {
      await replayMigrations(tx);
      await tx`delete from public.categories where user_id = ${user.id}`;
      await tx`select public.seed_categories(${user.id}::uuid)`;
      await tx`select public.seed_categories(${user.id}::uuid)`;
      const rows = await tx<{ key: string; name: string; is_system: boolean; color: string }[]>`
        select key, name, is_system, color from public.categories where user_id = ${user.id} order by key`;
      expect(rows).toHaveLength(17);
      expect(Object.fromEntries(rows.map((r) => [r.key, r.color]))).toEqual(SEEDED_COLORS);
      expect(new Set(rows.map((r) => r.color)).size).toBe(17);
      expect(rows.filter((r) => r.is_system).map((r) => r.key).sort()).toEqual([
        'Investments',
        'Reversal',
        'Uncategorized',
      ]);
      expect(rows.find((r) => r.key === 'Help')?.name).toBe('Ajuda (a terceiros)');
      const [priv] = await tx`
        select has_function_privilege('authenticated', 'public.seed_categories(uuid)', 'execute') as a,
               has_function_privilege('anon', 'public.seed_categories(uuid)', 'execute') as n`;
      expect(priv).toEqual({ a: false, n: false });
    });
  });

  it('remaps the post-0008 state: seeded rows, bank accounts and user-chosen colors move to their family-400, nothing else changes', async () => {
    expect(REMAP.length).toBeGreaterThan(100);
    const user = await createTestUser();
    await getAdminSql()`insert into public.categories (user_id, name) values (${user.id}, 'Minha')`;
    for (const bank of Object.keys(BANK_COLORS)) {
      await getAdminSql()`insert into public.accounts (user_id, bank, nickname, holder_names)
        values (${user.id}, ${bank}, ${`Conta ${bank}`}, ${['A']})`;
    }
    const categoriesBefore = await getAdminSql()`
      select id, key, name, is_system from public.categories where user_id = ${user.id} order by id`;
    const accountsBefore = await getAdminSql()`
      select id, bank, nickname, holder_names, active from public.accounts where user_id = ${user.id} order by id`;

    await inRolledBackTransaction(async (tx) => {
      // The state 0008 leaves (600/900 colors from its backfill), then user choices in every shade.
      await replayMigrations(tx, { stopAt0008: true });
      const [seededBefore] = await tx<{ color: string }[]>`
        select color from public.categories where user_id = ${user.id} and key = 'Food'`;
      expect(seededBefore?.color).toBe('orange-600');
      await tx`update public.categories set color = 'rose-900' where user_id = ${user.id} and name = 'Minha'`;
      await tx`update public.accounts set color = 'cyan-400' where user_id = ${user.id} and bank = 'XP'`;

      await tx.unsafe(MIGRATION_0009);

      const categoriesAfter = await tx`
        select id, key, name, is_system from public.categories where user_id = ${user.id} order by id`;
      expect(categoriesAfter).toEqual(categoriesBefore);
      const accountsAfter = await tx`
        select id, bank, nickname, holder_names, active from public.accounts where user_id = ${user.id} order by id`;
      expect(accountsAfter).toEqual(accountsBefore);
      const cats = await tx<{ key: string | null; name: string; color: string }[]>`
        select key, name, color from public.categories where user_id = ${user.id}`;
      const seeded = cats.filter((c) => c.key !== null);
      expect(Object.fromEntries(seeded.map((c) => [c.key, c.color]))).toEqual(SEEDED_COLORS);
      expect(new Set(seeded.map((c) => c.color)).size).toBe(17);
      expect(cats.find((c) => c.name === 'Minha')?.color).toBe('rose-400');
      const accounts = await tx<{ bank: string; account_color: string }[]>`
        select bank, color as account_color from public.accounts where user_id = ${user.id}`;
      expect(Object.fromEntries(accounts.map((a) => [a.bank, a.account_color]))).toEqual({
        ...BANK_COLORS,
        XP: 'cyan-400',
      });
      const [rejected] = await tx<{ color: string }[]>`
        select count(*)::text as color from public.categories where color ~ '-(600|900)$'`;
      expect(rejected?.color).toBe('0');
    });
  });

  it('fills only the existing rows of a user who deleted seeded categories and recreates nothing', async () => {
    const user = await createTestUser();
    await getAdminSql()`delete from public.categories where user_id = ${user.id} and key in ('Food', 'Pets')`;
    const before = await getAdminSql()`select id, key from public.categories where user_id = ${user.id} order by id`;
    expect(before).toHaveLength(15);

    await inRolledBackTransaction(async (tx) => {
      await replayMigrations(tx);
      const after = await tx<{ id: string; key: string; color: string }[]>`
        select id, key, color from public.categories where user_id = ${user.id} order by id`;
      expect(after.map((c) => c.id)).toEqual(before.map((c) => c.id));
      expect(after.some((c) => c.key === 'Food' || c.key === 'Pets')).toBe(false);
      expect(after.find((c) => c.key === 'Transport')?.color).toBe('blue-400');
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

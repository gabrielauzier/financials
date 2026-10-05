import type { TransactionSql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql } from './helpers/db.js';

afterAll(async () => {
  await cleanupTestUsers();
  await closeAdminSql();
});

/** Runs `fn` as the `authenticated` role with the given user's claims (raw SQL, no app code). */
async function asUser<T>(userId: string, fn: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return getAdminSql().begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated' })}, true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  }) as Promise<T>;
}

const SEEDED = [
  ['Entertainment', 'Entretenimento'],
  ['Food', 'Alimentação'],
  ['Salaries', 'Salários'],
  ['Healthcare', 'Saúde'],
  ['Utilities', 'Utilidades'],
  ['Unknown', 'Desconhecida'],
  ['Transport', 'Transporte'],
  ['Help', 'Ajuda (a terceiros)'],
  ['PJ', 'PJ'],
  ['Bills', 'Contas'],
  ['Emergency', 'Emergência'],
  ['Uncategorized', 'Sem categoria'],
  ['Wishes', 'Desejos'],
  ['Reversal', 'Estorno (de compras)'],
  ['Shopping', 'Compras'],
  ['Pets', 'Pets'],
  ['Investments', 'Investimentos'],
] as const;

const insertAccount = (tx: TransactionSql, nickname: string) =>
  tx`insert into public.accounts (bank, nickname, holder_names) values ('Nubank', ${nickname}, ${['Fulano']})`;

describe('accounts and categories migration', () => {
  it('seeds 17 categories with the spec keys and pt-BR names, exactly 3 of them system', async () => {
    const user = await createTestUser();
    const rows = await asUser(
      user.id,
      (tx) => tx<{ key: string; name: string; is_system: boolean }[]>`select key, name, is_system from public.categories`,
    );

    expect(rows).toHaveLength(17);
    expect(rows.map((r) => [r.key, r.name]).sort()).toEqual([...SEEDED].map((r) => [...r]).sort());
    expect(rows.filter((r) => r.is_system).map((r) => r.key).sort()).toEqual([
      'Investments',
      'Reversal',
      'Uncategorized',
    ]);
  });

  it('affects 0 rows when authenticated updates or deletes a system category, and still changes a regular one', async () => {
    const user = await createTestUser();
    const updated = await asUser(user.id, (tx) => tx`update public.categories set name = 'X' where key = 'Reversal'`);
    expect(updated.count).toBe(0);
    const deleted = await asUser(user.id, (tx) => tx`delete from public.categories where key = 'Uncategorized'`);
    expect(deleted.count).toBe(0);
    const stillThere = await asUser(
      user.id,
      (tx) => tx`select 1 from public.categories where key in ('Reversal', 'Uncategorized') and name in ('Estorno (de compras)', 'Sem categoria')`,
    );
    expect(stillThere).toHaveLength(2);

    // Positive control: a regular category is editable, so the 0 above comes from the system rule.
    const regular = await asUser(user.id, (tx) => tx`update public.categories set name = 'Mercado' where key = 'Food'`);
    expect(regular.count).toBe(1);
  });

  it('does not let authenticated create a system category', async () => {
    const user = await createTestUser();
    await expect(
      asUser(user.id, (tx) => tx`insert into public.categories (name, is_system) values ('Nova', true)`),
    ).rejects.toThrow(/row-level security/);
  });

  it('fails when authenticated deletes from accounts', async () => {
    const user = await createTestUser();
    await asUser(user.id, (tx) => insertAccount(tx, 'Principal'));
    await expect(asUser(user.id, (tx) => tx`delete from public.accounts`)).rejects.toThrow(/permission denied/);
    const rows = await getAdminSql()`select id from public.accounts where user_id = ${user.id}`;
    expect(rows).toHaveLength(1);
  });

  it('does not let anon or authenticated truncate the new tables', async () => {
    const user = await createTestUser();
    await expect(asUser(user.id, (tx) => tx`truncate public.accounts`)).rejects.toThrow(/permission denied/);
    await expect(asUser(user.id, (tx) => tx`truncate public.categories`)).rejects.toThrow(/permission denied/);
    const [anon] = await getAdminSql()`
      select has_table_privilege('anon', 'public.accounts', 'truncate') as a,
             has_table_privilege('anon', 'public.categories', 'truncate') as c`;
    expect(anon).toEqual({ a: false, c: false });
  });

  it('violates the unique index for a duplicate account nickname in any case', async () => {
    const user = await createTestUser();
    await asUser(user.id, (tx) => insertAccount(tx, 'Nubank Pessoal'));
    await expect(asUser(user.id, (tx) => insertAccount(tx, 'nubank pessoal'))).rejects.toThrow(/accounts_nickname_uq/);
    await expect(asUser(user.id, (tx) => insertAccount(tx, '  NUBANK PESSOAL '))).rejects.toThrow(/accounts_nickname_uq/);
  });

  it('violates the unique index for a duplicate category name in any case', async () => {
    const user = await createTestUser();
    await expect(
      asUser(user.id, (tx) => tx`insert into public.categories (name) values ('alimentação')`),
    ).rejects.toThrow(/categories_name_uq/);
    await asUser(user.id, (tx) => tx`insert into public.categories (name) values ('Viagens')`);
    await expect(
      asUser(user.id, (tx) => tx`insert into public.categories (name) values ('VIAGENS')`),
    ).rejects.toThrow(/categories_name_uq/);
  });

  it('isolates accounts and categories between two users', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const [acc] = await asUser(a.id, (tx) => tx<{ id: string }[]>`
      insert into public.accounts (bank, nickname, holder_names) values ('XP', 'Conta A', ${['A']}) returning id`);
    await asUser(a.id, (tx) => tx`insert into public.categories (name) values ('Só da A')`);

    expect(await asUser(b.id, (tx) => tx`select id from public.accounts`)).toHaveLength(0);
    const bCategories = await asUser(b.id, (tx) => tx<{ name: string }[]>`select name from public.categories`);
    expect(bCategories).toHaveLength(17);
    expect(bCategories.map((c) => c.name)).not.toContain('Só da A');

    const updated = await asUser(b.id, (tx) => tx`update public.accounts set nickname = 'Hack' where id = ${acc?.id ?? ''}`);
    expect(updated.count).toBe(0);
    const renamed = await asUser(b.id, (tx) => tx`update public.categories set name = 'Hack' where user_id = ${a.id}`);
    expect(renamed.count).toBe(0);
    await expect(
      asUser(b.id, (tx) => tx`insert into public.accounts (user_id, bank, nickname, holder_names) values (${a.id}, 'XP', 'Forjada', ${['x']})`),
    ).rejects.toThrow(/row-level security/);

    const own = await asUser(a.id, (tx) => tx`update public.accounts set nickname = 'Conta A2' where id = ${acc?.id ?? ''}`);
    expect(own.count).toBe(1);
  });

  it('does not duplicate categories when the seed runs twice', async () => {
    const user = await createTestUser();
    await getAdminSql()`select public.seed_categories(${user.id}::uuid)`;
    await getAdminSql()`select public.seed_categories(${user.id}::uuid)`;
    const [row] = await getAdminSql()`select count(*)::int as n from public.categories where user_id = ${user.id}`;
    expect(row?.n).toBe(17);
  });

  it('does not let authenticated or anon execute seed_categories', async () => {
    const user = await createTestUser();
    await expect(
      asUser(user.id, (tx) => tx`select public.seed_categories(${user.id}::uuid)`),
    ).rejects.toThrow(/permission denied/);
  });
});

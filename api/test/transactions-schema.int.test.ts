import type { TransactionSql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';

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

interface Fixture {
  user: TestUser;
  accountId: string;
  categoryId: string;
}

async function fixture(): Promise<Fixture> {
  const user = await createTestUser();
  const [account] = await asUser(user.id, (tx) => tx<{ id: string }[]>`
    insert into public.accounts (bank, nickname, holder_names) values ('Nubank', 'Principal', ${['Fulano']}) returning id`);
  const [category] = await asUser(user.id, (tx) => tx<{ id: string }[]>`
    select id from public.categories where key = 'Uncategorized'`);
  return { user, accountId: account?.id ?? '', categoryId: category?.id ?? '' };
}

const insertTx = (
  tx: TransactionSql,
  f: Fixture,
  over: { amount?: string; type?: string; method?: string; accountId?: string; categoryId?: string } = {},
) => tx`
  insert into public.transactions (account_id, category_id, name, type, occurred_at, amount, payment_method)
  values (${over.accountId ?? f.accountId}, ${over.categoryId ?? f.categoryId}, 'Mercado', ${over.type ?? 'Expense'},
          '2026-10-01T12:00:00Z', ${over.amount ?? '10.00'}, ${over.method ?? 'PIX'})`;

describe('transactions migration: constraints', () => {
  it('rejects amount 0, negative and 3 decimals, and accepts 0.01', async () => {
    const f = await fixture();
    for (const amount of ['0', '0.00', '-5.00']) {
      await expect(asUser(f.user.id, (tx) => insertTx(tx, f, { amount }))).rejects.toThrow(/transactions_amount_check/);
    }
    await asUser(f.user.id, (tx) => insertTx(tx, f, { amount: '0.01' }));
    const rows = await asUser(f.user.id, (tx) => tx<{ amount: string }[]>`select amount::text from public.transactions`);
    expect(rows).toEqual([{ amount: '0.01' }]);
  });

  it('rejects a 3-decimal amount that rounds to zero (0.004) and a 13-integer-digit overflow', async () => {
    const f = await fixture();
    await expect(asUser(f.user.id, (tx) => insertTx(tx, f, { amount: '0.004' }))).rejects.toThrow(
      /transactions_amount_check/,
    );
    await expect(asUser(f.user.id, (tx) => insertTx(tx, f, { amount: '1000000000000.00' }))).rejects.toThrow(
      /numeric field overflow/,
    );
  });

  it('rejects an invalid type and an invalid payment method', async () => {
    const f = await fixture();
    await expect(asUser(f.user.id, (tx) => insertTx(tx, f, { type: 'Transfer' }))).rejects.toThrow(
      /transactions_type_check/,
    );
    await expect(asUser(f.user.id, (tx) => insertTx(tx, f, { method: 'Bitcoin' }))).rejects.toThrow(
      /transactions_payment_method_check/,
    );
    for (const method of ['BankTransfer', 'Boleto', 'Cash', 'CreditCard', 'DebitCard', 'NuPay', 'PIX']) {
      await asUser(f.user.id, (tx) => insertTx(tx, f, { method }));
    }
  });

  it('does not let a transaction reference another user\'s account or category', async () => {
    const a = await fixture();
    const b = await fixture();
    await expect(
      asUser(b.user.id, (tx) => insertTx(tx, b, { accountId: a.accountId })),
    ).rejects.toThrow(/foreign key/);
    await expect(
      asUser(b.user.id, (tx) => insertTx(tx, b, { categoryId: a.categoryId })),
    ).rejects.toThrow(/foreign key/);
    // Even bypassing RLS (admin), the composite FK stops a cross-user reference.
    await expect(
      getAdminSql()`
        insert into public.transactions (user_id, account_id, category_id, name, type, occurred_at, amount, payment_method)
        values (${b.user.id}, ${a.accountId}, ${b.categoryId}, 'X', 'Expense', now(), 1, 'PIX')`,
    ).rejects.toThrow(/foreign key/);
  });

  it('deletes a user that owns accounts, categories and transactions', async () => {
    const f = await fixture();
    await asUser(f.user.id, (tx) => insertTx(tx, f));
    await asUser(f.user.id, (tx) => tx`insert into public.categories (name) values ('Extra')`);
    const { serviceRoleKey, apiUrl } = (await import('./helpers/stack.js')).getLocalStack();
    const res = await fetch(`${apiUrl}/auth/v1/admin/users/${f.user.id}`, {
      method: 'DELETE',
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
    });
    expect(res.ok).toBe(true);
    const sql = getAdminSql();
    expect(await sql`select 1 from public.transactions where user_id = ${f.user.id}`).toHaveLength(0);
    expect(await sql`select 1 from public.accounts where user_id = ${f.user.id}`).toHaveLength(0);
    expect(await sql`select 1 from public.categories where user_id = ${f.user.id}`).toHaveLength(0);
  });

  it('calls unaccent as authenticated', async () => {
    const f = await fixture();
    const [row] = await asUser(f.user.id, (tx) => tx<{ v: string }[]>`select extensions.unaccent('Café Ação') as v`);
    expect(row?.v).toBe('Cafe Acao');
  });

  it('does not let anon or authenticated truncate transactions', async () => {
    const f = await fixture();
    await expect(asUser(f.user.id, (tx) => tx`truncate public.transactions`)).rejects.toThrow(/permission denied/);
    const [anon] = await getAdminSql()`select has_table_privilege('anon', 'public.transactions', 'truncate') as a`;
    expect(anon).toEqual({ a: false });
  });
});

describe('transactions migration: RLS', () => {
  it('isolates rows between two users (select, insert, update, delete)', async () => {
    const a = await fixture();
    const b = await fixture();
    const [row] = await asUser(a.user.id, (tx) => tx<{ id: string }[]>`
      insert into public.transactions (account_id, category_id, name, type, occurred_at, amount, payment_method)
      values (${a.accountId}, ${a.categoryId}, 'Da A', 'Income', now(), 5, 'PIX') returning id`);
    const id = row?.id ?? '';

    expect(await asUser(b.user.id, (tx) => tx`select id from public.transactions`)).toHaveLength(0);
    expect((await asUser(b.user.id, (tx) => tx`update public.transactions set name = 'Hack' where id = ${id}`)).count).toBe(0);
    expect((await asUser(b.user.id, (tx) => tx`delete from public.transactions where id = ${id}`)).count).toBe(0);
    await expect(
      asUser(b.user.id, (tx) => tx`
        insert into public.transactions (user_id, account_id, category_id, name, type, occurred_at, amount, payment_method)
        values (${a.user.id}, ${a.accountId}, ${a.categoryId}, 'Forjada', 'Expense', now(), 1, 'PIX')`),
    ).rejects.toThrow(/row-level security/);

    // Positive control: the owner still sees and edits the row.
    expect(await asUser(a.user.id, (tx) => tx`select id from public.transactions`)).toHaveLength(1);
    expect((await asUser(a.user.id, (tx) => tx`update public.transactions set name = 'Minha' where id = ${id}`)).count).toBe(1);
  });
});

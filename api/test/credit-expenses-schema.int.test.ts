import type { TransactionSql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { getLocalStack } from './helpers/stack.js';

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
    insert into public.accounts (bank, nickname, holder_names) values ('Nubank', 'Cartão', ${['Fulano']}) returning id`);
  const [category] = await asUser(user.id, (tx) => tx<{ id: string }[]>`
    select id from public.categories where key = 'Uncategorized'`);
  return { user, accountId: account?.id ?? '', categoryId: category?.id ?? '' };
}

interface Over {
  total?: string;
  paid?: string;
  day?: number;
  status?: string;
  name?: string;
  accountId?: string;
  categoryId?: string;
}

const insertCe = (tx: TransactionSql, f: Fixture, over: Over = {}) => tx`
  insert into public.credit_expenses
    (account_id, category_id, name, total_amount, paid_amount, occurred_at, recurrency_day, status)
  values (${over.accountId ?? f.accountId}, ${over.categoryId ?? f.categoryId}, ${over.name ?? 'Netflix'},
          ${over.total ?? '600.00'}, ${over.paid ?? '0'}, '2026-10-01T12:00:00Z', ${over.day ?? 5},
          ${over.status ?? 'Active'})`;

describe('credit_expenses migration: constraints', () => {
  it('rejects total 0, negative and a 3-decimal amount rounding to zero, and accepts 0.01', async () => {
    const f = await fixture();
    for (const total of ['0', '0.004']) {
      await expect(asUser(f.user.id, (tx) => insertCe(tx, f, { total }))).rejects.toThrow(
        /credit_expenses_total_amount_check/,
      );
    }
    // A negative total also breaks paid <= total; Postgres reports whichever check it evaluates first.
    await expect(asUser(f.user.id, (tx) => insertCe(tx, f, { total: '-5.00' }))).rejects.toThrow(
      /credit_expenses_(total_amount|paid_range)_check/,
    );
    await asUser(f.user.id, (tx) => insertCe(tx, f, { total: '0.01' }));
    const rows = await asUser(f.user.id, (tx) => tx<{ total: string; paid: string }[]>`
      select total_amount::text as total, paid_amount::text as paid from public.credit_expenses`);
    expect(rows).toEqual([{ total: '0.01', paid: '0.00' }]);
  });

  it('rejects paid below 0 and above total, and accepts 0 and paid equal to total', async () => {
    const f = await fixture();
    for (const paid of ['-0.01', '600.01']) {
      await expect(asUser(f.user.id, (tx) => insertCe(tx, f, { total: '600.00', paid }))).rejects.toThrow(
        /credit_expenses_paid_range_check/,
      );
    }
    await asUser(f.user.id, (tx) => insertCe(tx, f, { total: '600.00', paid: '0' }));
    await asUser(f.user.id, (tx) => insertCe(tx, f, { total: '600.00', paid: '600.00' }));
    // The same rule holds on update: lowering the total under the paid amount is refused.
    await expect(
      asUser(f.user.id, (tx) => tx`update public.credit_expenses set total_amount = 100 where paid_amount = 600`),
    ).rejects.toThrow(/credit_expenses_paid_range_check/);
  });

  it('rejects a recurrency day outside 1-31 and accepts both limits', async () => {
    const f = await fixture();
    for (const day of [0, 32, -1]) {
      await expect(asUser(f.user.id, (tx) => insertCe(tx, f, { day }))).rejects.toThrow(
        /credit_expenses_recurrency_day_check/,
      );
    }
    await asUser(f.user.id, (tx) => insertCe(tx, f, { day: 1 }));
    await asUser(f.user.id, (tx) => insertCe(tx, f, { day: 31 }));
  });

  it('rejects a status outside the list and accepts each of the 5', async () => {
    const f = await fixture();
    for (const status of ['Paused', 'active', '']) {
      await expect(asUser(f.user.id, (tx) => insertCe(tx, f, { status }))).rejects.toThrow(
        /credit_expenses_status_check/,
      );
    }
    for (const status of ['Once', 'Active', 'Inactive', 'Canceled', 'ToCancel']) {
      await asUser(f.user.id, (tx) => insertCe(tx, f, { status }));
    }
  });

  it('rejects a blank name and a 13-integer-digit overflow', async () => {
    const f = await fixture();
    await expect(asUser(f.user.id, (tx) => insertCe(tx, f, { name: '   ' }))).rejects.toThrow(
      /credit_expenses_name_check/,
    );
    await expect(asUser(f.user.id, (tx) => insertCe(tx, f, { total: '1000000000000.00' }))).rejects.toThrow(
      /numeric field overflow/,
    );
  });

  it("does not let a credit expense reference another user's account or category", async () => {
    const a = await fixture();
    const b = await fixture();
    await expect(asUser(b.user.id, (tx) => insertCe(tx, b, { accountId: a.accountId }))).rejects.toThrow(/foreign key/);
    await expect(asUser(b.user.id, (tx) => insertCe(tx, b, { categoryId: a.categoryId }))).rejects.toThrow(
      /foreign key/,
    );
    // Even bypassing RLS (admin), the composite FK stops a cross-user reference.
    await expect(
      getAdminSql()`
        insert into public.credit_expenses
          (user_id, account_id, category_id, name, total_amount, occurred_at, recurrency_day, status)
        values (${b.user.id}, ${a.accountId}, ${b.categoryId}, 'X', 1, now(), 1, 'Once')`,
    ).rejects.toThrow(/foreign key/);
    await expect(
      getAdminSql()`
        insert into public.credit_expenses
          (user_id, account_id, category_id, name, total_amount, occurred_at, recurrency_day, status)
        values (${b.user.id}, ${b.accountId}, ${a.categoryId}, 'X', 1, now(), 1, 'Once')`,
    ).rejects.toThrow(/foreign key/);
  });

  it('deletes a user that owns accounts, categories and credit expenses', async () => {
    const f = await fixture();
    await asUser(f.user.id, (tx) => insertCe(tx, f));
    await asUser(f.user.id, (tx) => tx`insert into public.categories (name) values ('Extra')`);
    const { serviceRoleKey, apiUrl } = getLocalStack();
    const res = await fetch(`${apiUrl}/auth/v1/admin/users/${f.user.id}`, {
      method: 'DELETE',
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
    });
    expect(res.ok).toBe(true);
    const sql = getAdminSql();
    expect(await sql`select 1 from public.credit_expenses where user_id = ${f.user.id}`).toHaveLength(0);
    expect(await sql`select 1 from public.accounts where user_id = ${f.user.id}`).toHaveLength(0);
    expect(await sql`select 1 from public.categories where user_id = ${f.user.id}`).toHaveLength(0);
  });

  it('does not let anon or authenticated truncate credit_expenses', async () => {
    const f = await fixture();
    await expect(asUser(f.user.id, (tx) => tx`truncate public.credit_expenses`)).rejects.toThrow(/permission denied/);
    const [anon] = await getAdminSql()`select has_table_privilege('anon', 'public.credit_expenses', 'truncate') as a`;
    expect(anon).toEqual({ a: false });
  });
});

describe('credit_expenses migration: RLS', () => {
  async function ownedRow(f: Fixture): Promise<string> {
    const [row] = await asUser(f.user.id, (tx) => tx<{ id: string }[]>`
      insert into public.credit_expenses
        (account_id, category_id, name, total_amount, occurred_at, recurrency_day, status)
      values (${f.accountId}, ${f.categoryId}, 'Da A', 50, now(), 10, 'Active') returning id`);
    return row?.id ?? '';
  }

  it("hides another user's rows from select", async () => {
    const a = await fixture();
    const b = await fixture();
    await ownedRow(a);
    expect(await asUser(b.user.id, (tx) => tx`select id from public.credit_expenses`)).toHaveLength(0);
    // Positive control: the owner sees the row.
    expect(await asUser(a.user.id, (tx) => tx`select id from public.credit_expenses`)).toHaveLength(1);
  });

  it("does not let another user update or delete a row, while the owner can", async () => {
    const a = await fixture();
    const b = await fixture();
    const id = await ownedRow(a);
    expect((await asUser(b.user.id, (tx) => tx`update public.credit_expenses set name = 'Hack' where id = ${id}`)).count).toBe(0);
    expect((await asUser(b.user.id, (tx) => tx`delete from public.credit_expenses where id = ${id}`)).count).toBe(0);
    expect((await asUser(a.user.id, (tx) => tx`update public.credit_expenses set name = 'Minha' where id = ${id}`)).count).toBe(1);
    expect((await asUser(a.user.id, (tx) => tx`delete from public.credit_expenses where id = ${id}`)).count).toBe(1);
  });

  it('refuses an insert forged for another user', async () => {
    const a = await fixture();
    const b = await fixture();
    await expect(
      asUser(b.user.id, (tx) => tx`
        insert into public.credit_expenses
          (user_id, account_id, category_id, name, total_amount, occurred_at, recurrency_day, status)
        values (${a.user.id}, ${a.accountId}, ${a.categoryId}, 'Forjada', 1, now(), 1, 'Once')`),
    ).rejects.toThrow(/row-level security/);
    expect(await getAdminSql()`select 1 from public.credit_expenses where user_id = ${a.user.id}`).toHaveLength(0);
  });
});

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
}

async function fixture(): Promise<Fixture> {
  const user = await createTestUser();
  const [account] = await asUser(user.id, (tx) => tx<{ id: string }[]>`
    insert into public.accounts (bank, nickname, holder_names) values ('Nubank', 'Corretora', ${['Fulano']}) returning id`);
  return { user, accountId: account?.id ?? '' };
}

const insertReturn = (tx: TransactionSql, accountId: string, amount: string, on = '2026-10-01') => tx`
  insert into public.investment_returns (account_id, occurred_on, amount) values (${accountId}, ${on}, ${amount})`;

describe('investment_returns migration: constraints', () => {
  it('rejects amount 0 (and a 3-decimal amount rounding to 0), accepts positive and negative values', async () => {
    const f = await fixture();
    for (const amount of ['0', '0.00', '0.004']) {
      await expect(asUser(f.user.id, (tx) => insertReturn(tx, f.accountId, amount))).rejects.toThrow(
        /investment_returns_amount_check/,
      );
    }
    await asUser(f.user.id, (tx) => insertReturn(tx, f.accountId, '50.00'));
    await asUser(f.user.id, (tx) => insertReturn(tx, f.accountId, '-20.00'));
    const rows = await asUser(f.user.id, (tx) => tx<{ amount: string }[]>`
      select amount::text as amount from public.investment_returns order by amount`);
    expect(rows).toEqual([{ amount: '-20.00' }, { amount: '50.00' }]);
  });

  it("does not let a return reference another user's account", async () => {
    const a = await fixture();
    const b = await fixture();
    await expect(asUser(b.user.id, (tx) => insertReturn(tx, a.accountId, '10.00'))).rejects.toThrow(/foreign key/);
    // Even bypassing RLS (admin), the composite FK stops a cross-user reference.
    await expect(
      getAdminSql()`
        insert into public.investment_returns (user_id, account_id, occurred_on, amount)
        values (${b.user.id}, ${a.accountId}, '2026-10-01', 10)`,
    ).rejects.toThrow(/foreign key/);
  });

  it('does not let anon or authenticated truncate investment_returns', async () => {
    const f = await fixture();
    await expect(asUser(f.user.id, (tx) => tx`truncate public.investment_returns`)).rejects.toThrow(
      /permission denied/,
    );
    const [anon] = await getAdminSql()`select has_table_privilege('anon', 'public.investment_returns', 'truncate') as a`;
    expect(anon).toEqual({ a: false });
  });

  it('deletes a user that owns accounts and returns', async () => {
    const f = await fixture();
    await asUser(f.user.id, (tx) => insertReturn(tx, f.accountId, '5.00'));
    await getAdminSql()`delete from auth.users where id = ${f.user.id}`;
    expect(await getAdminSql()`select 1 from public.investment_returns where user_id = ${f.user.id}`).toHaveLength(0);
  });
});

describe('investment_returns migration: RLS', () => {
  async function ownedRow(f: Fixture): Promise<string> {
    const [row] = await asUser(f.user.id, (tx) => tx<{ id: string }[]>`
      insert into public.investment_returns (account_id, occurred_on, amount)
      values (${f.accountId}, '2026-10-01', 50) returning id`);
    return row?.id ?? '';
  }

  it("hides another user's rows from select", async () => {
    const a = await fixture();
    const b = await fixture();
    await ownedRow(a);
    expect(await asUser(b.user.id, (tx) => tx`select id from public.investment_returns`)).toHaveLength(0);
    // Positive control: the owner sees the row.
    expect(await asUser(a.user.id, (tx) => tx`select id from public.investment_returns`)).toHaveLength(1);
  });

  it('does not let another user update or delete a row, while the owner can', async () => {
    const a = await fixture();
    const b = await fixture();
    const id = await ownedRow(a);
    expect((await asUser(b.user.id, (tx) => tx`update public.investment_returns set amount = 1 where id = ${id}`)).count).toBe(0);
    expect((await asUser(b.user.id, (tx) => tx`delete from public.investment_returns where id = ${id}`)).count).toBe(0);
    expect((await asUser(a.user.id, (tx) => tx`update public.investment_returns set amount = 2 where id = ${id}`)).count).toBe(1);
    expect((await asUser(a.user.id, (tx) => tx`delete from public.investment_returns where id = ${id}`)).count).toBe(1);
  });

  it('refuses an insert forged for another user', async () => {
    const a = await fixture();
    const b = await fixture();
    await expect(
      asUser(b.user.id, (tx) => tx`
        insert into public.investment_returns (user_id, account_id, occurred_on, amount)
        values (${a.user.id}, ${a.accountId}, '2026-10-01', 1)`),
    ).rejects.toThrow(/row-level security/);
    expect(await getAdminSql()`select 1 from public.investment_returns where user_id = ${a.user.id}`).toHaveLength(0);
  });
});

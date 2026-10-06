import type { TransactionSql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql } from './helpers/db.js';

afterAll(async () => {
  await cleanupTestUsers();
  await closeAdminSql();
});

/** Reads profiles as the `authenticated` role with the given user's claims (raw SQL, no app code). */
async function profilesVisibleTo(userId: string): Promise<{ id: string }[]> {
  return getAdminSql().begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated' })}, true)`;
    await tx`set local role authenticated`;
    return tx<{ id: string }[]>`select id from public.profiles`;
  });
}

/** Runs `fn` as the `authenticated` role with the given user's claims (raw SQL, no app code). */
async function asUser<T>(userId: string, fn: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return getAdminSql().begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated' })}, true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  }) as Promise<T>;
}

describe('profiles migration', () => {
  it('creates a profiles row with name and nickname when an auth user is created', async () => {
    const user = await createTestUser({ name: 'Maria Silva', nickname: 'mari' });
    const rows = await getAdminSql()`select name, nickname from public.profiles where id = ${user.id}`;
    expect(rows).toEqual([{ name: 'Maria Silva', nickname: 'mari' }]);
  });

  it('lets a user read only their own profile; another user reads none of it', async () => {
    const a = await createTestUser();
    const b = await createTestUser();

    const seenByA = await profilesVisibleTo(a.id);
    expect(seenByA.map((r) => r.id)).toEqual([a.id]);

    const seenByB = await profilesVisibleTo(b.id);
    expect(seenByB.map((r) => r.id)).toEqual([b.id]);
    expect(seenByB.map((r) => r.id)).not.toContain(a.id);
  });

  it('defines handle_new_user as security definer with search_path pinned to public', async () => {
    const rows = await getAdminSql()`
      select p.prosecdef as security_definer, p.proconfig as config
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'handle_new_user'`;
    expect(rows).toEqual([{ security_definer: true, config: ['search_path=public'] }]);
  });

  it("does not let another user update or delete a user's profile (0 rows affected)", async () => {
    const a = await createTestUser({ name: 'Owner', nickname: 'owner' });
    const b = await createTestUser();

    const updated = await asUser(b.id, (tx) => tx`update public.profiles set name = 'Hacked' where id = ${a.id}`);
    expect(updated.count).toBe(0);

    const deleted = await asUser(b.id, (tx) => tx`delete from public.profiles where id = ${a.id}`);
    expect(deleted.count).toBe(0);

    const rows = await getAdminSql()`select name, nickname from public.profiles where id = ${a.id}`;
    expect(rows).toEqual([{ name: 'Owner', nickname: 'owner' }]);

    // Positive control: the owner's own update goes through, so the 0 above comes from RLS.
    const own = await asUser(a.id, (tx) => tx`update public.profiles set name = 'Renamed' where id = ${a.id}`);
    expect(own.count).toBe(1);
  });
});

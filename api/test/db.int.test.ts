import Fastify from 'fastify';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { dbPlugin, createWithUser } from '../src/plugins/db.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql } from './helpers/db.js';
import { getLocalStack } from './helpers/stack.js';

// One connection only, so consecutive calls are guaranteed to reuse the same session.
const sql = postgres(getLocalStack().dbUrl, { max: 1, onnotice: () => {} });
const withUser = createWithUser(sql);

afterAll(async () => {
  await sql.end();
  await cleanupTestUsers();
  await closeAdminSql();
});

const claimsFor = (sub: string) => ({ sub, role: 'authenticated' });

async function identity(tx: postgres.TransactionSql): Promise<{ uid: string | null; role: string }> {
  const [row] = await tx<{ uid: string | null; role: string }[]>`
    select auth.uid()::text as uid, current_user::text as role`;
  if (!row) throw new Error('no row');
  return row;
}

describe('withUser', () => {
  it('runs with auth.uid() equal to the subject and the authenticated role', async () => {
    const user = await createTestUser();
    const app = Fastify();
    await app.register(dbPlugin, { databaseUrl: getLocalStack().dbUrl });
    await app.ready();
    try {
      const seen = await app.withUser(claimsFor(user.id), identity);
      expect(seen).toEqual({ uid: user.id, role: 'authenticated' });
    } finally {
      await app.close();
    }
  });

  it('never leaks claims or role between consecutive calls on the same connection', async () => {
    const a = await createTestUser();
    const b = await createTestUser();

    expect(await withUser(claimsFor(a.id), identity)).toEqual({ uid: a.id, role: 'authenticated' });
    expect(await withUser(claimsFor(b.id), identity)).toEqual({ uid: b.id, role: 'authenticated' });
    expect(await withUser(claimsFor(a.id), identity)).toEqual({ uid: a.id, role: 'authenticated' });

    // RLS view of the same session: each call sees only its own profile.
    const visible = (tx: postgres.TransactionSql) => tx<{ id: string }[]>`select id from public.profiles`;
    expect((await withUser(claimsFor(b.id), visible)).map((r) => r.id)).toEqual([b.id]);
    expect((await withUser(claimsFor(a.id), visible)).map((r) => r.id)).toEqual([a.id]);

    // After withUser, a plain query on the same connection carries no claims and no role switch.
    const [plain] = await sql<{ claims: string | null; role: string }[]>`
      select current_setting('request.jwt.claims', true) as claims, current_user::text as role`;
    expect(plain?.claims ?? '').toBe('');
    expect(plain?.role).not.toBe('authenticated');
  });

  it('rolls back the transaction when fn throws', async () => {
    const user = await createTestUser({ name: 'Original Name' });
    const failure = new Error('boom');

    await expect(
      withUser(claimsFor(user.id), async (tx) => {
        const updated = await tx`update public.profiles set name = 'Changed' where id = ${user.id} returning id`;
        expect(updated).toHaveLength(1); // the write happened inside the transaction
        throw failure;
      }),
    ).rejects.toBe(failure);

    const [row] = await getAdminSql()`select name from public.profiles where id = ${user.id}`;
    expect(row?.name).toBe('Original Name');
  });
});

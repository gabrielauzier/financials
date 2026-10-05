import { afterAll, describe, expect, it } from 'vitest';
import { getLocalStack } from './stack.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql } from './db.js';

afterAll(async () => {
  await cleanupTestUsers();
  await closeAdminSql();
});

describe('createTestUser', () => {
  it('returns { id, token } for a confirmed user present in auth.users', async () => {
    const user = await createTestUser();
    const rows = await getAdminSql()`
      select id, email_confirmed_at is not null as confirmed
      from auth.users where id = ${user.id}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.confirmed).toBe(true);

    // The token is a real access token accepted by the local stack.
    const { apiUrl, anonKey } = getLocalStack();
    const res = await fetch(`${apiUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${user.token}` },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { id: string }).id).toBe(user.id);
  });

  it('produces two distinct users on two calls', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    expect(a.id).not.toBe(b.id);
    expect(a.email).not.toBe(b.email);
    expect(a.token).not.toBe(b.token);
  });

  it('cleanup removes the created users', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await cleanupTestUsers();
    const rows = await getAdminSql()`
      select id from auth.users where id in ${getAdminSql()([a.id, b.id])}`;
    expect(rows).toHaveLength(0);
  });
});

import { randomUUID } from 'node:crypto';
import type { TransactionSql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { getLocalStack } from './helpers/stack.js';

const uploaded = new Set<string>();

afterAll(async () => {
  // Storage objects are not removed when their owner is deleted (see the user deletion test).
  const { apiUrl, serviceRoleKey } = getLocalStack();
  if (uploaded.size > 0) {
    await fetch(`${apiUrl}/storage/v1/object/imports`, {
      method: 'DELETE',
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: [...uploaded] }),
    });
  }
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

const insertBatch = (tx: TransactionSql, f: Fixture, key: string = randomUUID()) => tx<{ id: string }[]>`
  insert into public.import_batches (account_id, bank, idempotency_key, row_count, imported_count, skipped_count)
  values (${f.accountId}, 'Nubank', ${key}, 14, 13, 1) returning id`;

const insertAttachment = (tx: TransactionSql, batchId: string, userId: string) => tx<{ id: string }[]>`
  insert into public.attachments (import_batch_id, filename, mime_type, size_bytes, storage_path)
  values (${batchId}, 'extrato.csv', 'text/csv', 1234, ${`${userId}/${batchId}/extrato.csv`}) returning id`;

const insertTx = (tx: TransactionSql, f: Fixture, batchId: string | null) => tx`
  insert into public.transactions (account_id, category_id, name, type, occurred_at, amount, payment_method, import_batch_id)
  values (${f.accountId}, ${f.categoryId}, 'Mercado', 'Expense', '2026-10-01T12:00:00Z', '10.00', 'PIX', ${batchId})`;

async function batchWithAttachment(f: Fixture): Promise<{ batchId: string; attachmentId: string }> {
  const [batch] = await asUser(f.user.id, (tx) => insertBatch(tx, f));
  const batchId = batch?.id ?? '';
  const [attachment] = await asUser(f.user.id, (tx) => insertAttachment(tx, batchId, f.user.id));
  return { batchId, attachmentId: attachment?.id ?? '' };
}

describe('imports migration: import_batches and attachments', () => {
  it('rejects a repeated (user_id, idempotency_key) and accepts the same key for another user', async () => {
    const a = await fixture();
    const b = await fixture();
    const key = randomUUID();
    await asUser(a.user.id, (tx) => insertBatch(tx, a, key));
    await expect(asUser(a.user.id, (tx) => insertBatch(tx, a, key))).rejects.toThrow(
      /import_batches_user_id_idempotency_key_key/,
    );
    await asUser(b.user.id, (tx) => insertBatch(tx, b, key));
    const rows = await getAdminSql()`select user_id from public.import_batches where idempotency_key = ${key}`;
    expect(rows).toHaveLength(2);
  });

  it('isolates batches and attachments between two users (select, insert, update, delete)', async () => {
    const a = await fixture();
    const b = await fixture();
    const { batchId, attachmentId } = await batchWithAttachment(a);

    expect(await asUser(b.user.id, (tx) => tx`select id from public.import_batches`)).toHaveLength(0);
    expect(await asUser(b.user.id, (tx) => tx`select id from public.attachments`)).toHaveLength(0);
    expect(
      (await asUser(b.user.id, (tx) => tx`update public.import_batches set row_count = 0 where id = ${batchId}`)).count,
    ).toBe(0);
    expect(
      (await asUser(b.user.id, (tx) => tx`update public.attachments set filename = 'x' where id = ${attachmentId}`)).count,
    ).toBe(0);
    expect((await asUser(b.user.id, (tx) => tx`delete from public.attachments where id = ${attachmentId}`)).count).toBe(0);
    expect((await asUser(b.user.id, (tx) => tx`delete from public.import_batches where id = ${batchId}`)).count).toBe(0);
    await expect(
      asUser(b.user.id, (tx) => tx`
        insert into public.import_batches (user_id, account_id, bank, idempotency_key, row_count, imported_count, skipped_count)
        values (${a.user.id}, ${a.accountId}, 'Nubank', ${randomUUID()}, 1, 1, 0)`),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(b.user.id, (tx) => tx`
        insert into public.attachments (user_id, import_batch_id, filename, mime_type, size_bytes, storage_path)
        values (${a.user.id}, ${batchId}, 'f.csv', 'text/csv', 1, 'p')`),
    ).rejects.toThrow(/row-level security/);

    // Positive control: the owner sees both rows.
    expect(await asUser(a.user.id, (tx) => tx`select id from public.import_batches`)).toHaveLength(1);
    expect(await asUser(a.user.id, (tx) => tx`select id from public.attachments`)).toHaveLength(1);
  });

  it('does not let a batch, attachment or transaction reference another user\'s rows', async () => {
    const a = await fixture();
    const b = await fixture();
    const { batchId } = await batchWithAttachment(a);

    // Batch on another user's account, attachment and transaction on another user's batch.
    await expect(asUser(b.user.id, (tx) => insertBatch(tx, { ...b, accountId: a.accountId }))).rejects.toThrow(
      /foreign key/,
    );
    await expect(asUser(b.user.id, (tx) => insertAttachment(tx, batchId, b.user.id))).rejects.toThrow(/foreign key/);
    await expect(asUser(b.user.id, (tx) => insertTx(tx, b, batchId))).rejects.toThrow(/transactions_import_batch_fkey/);

    // The owner links a transaction to the batch; a missing batch id is rejected.
    await asUser(a.user.id, (tx) => insertTx(tx, a, batchId));
    await expect(asUser(a.user.id, (tx) => insertTx(tx, a, randomUUID()))).rejects.toThrow(
      /transactions_import_batch_fkey/,
    );
  });

  it('has RLS with policies on both tables and no truncate for anon or authenticated', async () => {
    const tables = await getAdminSql()<{ table: string; rls: boolean; policies: number }[]>`
      select c.relname::text as table, c.relrowsecurity as rls,
             (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
      from pg_class c where c.oid in ('public.import_batches'::regclass, 'public.attachments'::regclass)
      order by 1`;
    expect(tables).toEqual([
      { table: 'attachments', rls: true, policies: 1 },
      { table: 'import_batches', rls: true, policies: 1 },
    ]);
    const f = await fixture();
    await expect(asUser(f.user.id, (tx) => tx`truncate public.import_batches cascade`)).rejects.toThrow(
      /permission denied/,
    );
    const [grants] = await getAdminSql()`
      select has_table_privilege('anon', 'public.import_batches', 'truncate') as a1,
             has_table_privilege('anon', 'public.attachments', 'truncate') as a2,
             has_table_privilege('authenticated', 'public.attachments', 'truncate') as a3`;
    expect(grants).toEqual({ a1: false, a2: false, a3: false });
  });
});

// ---- Storage: real behavior through the Storage HTTP API with real user tokens ----

interface StorageReply {
  status: number;
  body: string;
}

async function storage(
  token: string,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  content?: string,
): Promise<StorageReply> {
  const { apiUrl, anonKey } = getLocalStack();
  const res = await fetch(`${apiUrl}/storage/v1/object/imports/${path}`, {
    method,
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      ...(content === undefined ? {} : { 'content-type': 'text/csv' }),
      ...(method === 'PUT' ? { 'x-upsert': 'true' } : {}),
    },
    body: content,
  });
  return { status: res.status, body: await res.text() };
}

async function upload(token: string, path: string, content: string): Promise<StorageReply> {
  const reply = await storage(token, 'POST', path, content);
  if (reply.status === 200) uploaded.add(path);
  return reply;
}

describe('imports migration: Storage bucket `imports`', () => {
  it('lets a user upload to and read from their own folder only', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const own = `${a.id}/${randomUUID()}/extrato.csv`;

    const ok = await upload(a.token, own, 'Data,Valor\n');
    expect(ok.status).toBe(200);
    expect(await storage(a.token, 'GET', own)).toEqual({ status: 200, body: 'Data,Valor\n' });

    // FINDING: Storage answers a policy violation with HTTP 400 and `statusCode: "403"` in the body.
    const intoOther = await upload(b.token, `${a.id}/${randomUUID()}/forjado.csv`, 'x');
    expect(intoOther.status).toBe(400);
    expect(JSON.parse(intoOther.body)).toMatchObject({ statusCode: '403', message: expect.stringMatching(/row-level security/) });

    // Outside any user folder (bucket root) is rejected as well.
    const atRoot = await upload(a.token, `${randomUUID()}.csv`, 'x');
    expect(JSON.parse(atRoot.body)).toMatchObject({ statusCode: '403' });
  });

  it('hides and protects another user\'s object (read, overwrite)', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const path = `${a.id}/${randomUUID()}/extrato.csv`;
    expect((await upload(a.token, path, 'original')).status).toBe(200);

    // FINDING: a read blocked by RLS looks like a missing object (HTTP 400, `statusCode: "404"`).
    const read = await storage(b.token, 'GET', path);
    expect(read.status).toBe(400);
    expect(JSON.parse(read.body)).toMatchObject({ statusCode: '404' });

    const overwrite = await storage(b.token, 'PUT', path, 'tampered');
    expect(overwrite.status).toBe(400);
    expect(await storage(a.token, 'GET', path)).toEqual({ status: 200, body: 'original' });
  });

  it('rejects anonymous upload and read, and the bucket is not public', async () => {
    const a = await createTestUser();
    const { apiUrl, anonKey } = getLocalStack();
    const path = `${a.id}/${randomUUID()}/extrato.csv`;
    expect((await upload(a.token, path, 'secret')).status).toBe(200);

    const anonUpload = await upload(anonKey, `${a.id}/${randomUUID()}/anon.csv`, 'x');
    expect(JSON.parse(anonUpload.body)).toMatchObject({ statusCode: '403' });
    const anonRead = await storage(anonKey, 'GET', path);
    expect(anonRead.status).toBe(400);
    expect(anonRead.body).not.toContain('secret');
    const publicUrl = await fetch(`${apiUrl}/storage/v1/object/public/imports/${path}`);
    expect(publicUrl.status).toBe(400);
    expect(await publicUrl.text()).not.toContain('secret');

    const [bucket] = await getAdminSql()`select public from storage.buckets where id = 'imports'`;
    expect(bucket).toEqual({ public: false });
  });
});

describe('imports migration: user deletion', () => {
  it('deletes a user that owns batches, attachments, linked transactions and a stored file', async () => {
    const f = await fixture();
    const { batchId } = await batchWithAttachment(f);
    await asUser(f.user.id, (tx) => insertTx(tx, f, batchId));
    const path = `${f.user.id}/${batchId}/extrato.csv`;
    expect((await upload(f.user.token, path, 'Data,Valor\n')).status).toBe(200);

    const { serviceRoleKey, apiUrl } = getLocalStack();
    const res = await fetch(`${apiUrl}/auth/v1/admin/users/${f.user.id}`, {
      method: 'DELETE',
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
    });
    expect(res.ok).toBe(true);
    const sql = getAdminSql();
    expect(await sql`select 1 from public.transactions where user_id = ${f.user.id}`).toHaveLength(0);
    expect(await sql`select 1 from public.attachments where user_id = ${f.user.id}`).toHaveLength(0);
    expect(await sql`select 1 from public.import_batches where user_id = ${f.user.id}`).toHaveLength(0);
    expect(await sql`select 1 from public.accounts where user_id = ${f.user.id}`).toHaveLength(0);

    // FINDING: Storage keeps the object after its owner is deleted (no FK from storage.objects to
    // auth.users); removing the user's files is a separate, explicit step.
    expect(await sql`select 1 from storage.objects where bucket_id = 'imports' and name = ${path}`).toHaveLength(1);
  });
});

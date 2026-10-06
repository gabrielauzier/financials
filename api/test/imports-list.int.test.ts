import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { fixture } from './helpers/fixtures.js';
import { multipart } from './helpers/multipart.js';
import { getLocalStack } from './helpers/stack.js';
import { removeImportObjects } from './helpers/storage.js';

let app: FastifyInstance;
const userIds: string[] = [];

const ACCOUNT_CSV = fixture('nubank_account.csv');
const INVOICE_CSV = fixture('nubank_invoice.csv');

beforeAll(async () => {
  const { apiUrl, dbUrl, publishableKey } = getLocalStack();
  app = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl, supabasePublishableKey: publishableKey });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await removeImportObjects(userIds);
  await cleanupTestUsers();
  await closeAdminSql();
});

interface Owner {
  user: TestUser;
  accountId: string;
  nickname: string;
}

async function owner(nickname = `Conta ${randomUUID()}`): Promise<Owner> {
  const user = await createTestUser();
  userIds.push(user.id);
  const res = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { bank: 'Nubank', nickname, holderNames: ['Maria'] },
  });
  expect(res.statusCode).toBe(201);
  return { user, accountId: res.json<{ id: string }>().id, nickname };
}

async function confirm(o: Owner, filename: string, content: string, indexes: number[]) {
  const body = multipart(
    {
      accountId: o.accountId,
      idempotencyKey: randomUUID(),
      selections: JSON.stringify(indexes.map((index) => ({ index, neutral: false }))),
    },
    [{ filename, content }],
  );
  const res = await app.inject({
    method: 'POST',
    url: '/imports/confirm',
    headers: { authorization: `Bearer ${o.user.token}`, ...body.headers },
    payload: body.payload,
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ batchId: string }>().batchId;
}

function list(user: TestUser | null, query = '', authorization?: string) {
  const auth = authorization ?? (user ? `Bearer ${user.token}` : undefined);
  return app.inject({ method: 'GET', url: `/imports${query}`, headers: auth ? { authorization: auth } : {} });
}

interface ListedFile {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  bank: string;
  account: { id: string; nickname: string };
  createdAt: string;
  rowCount: number;
  importedCount: number;
  skippedCount: number;
}

/** Inserts `count` batches with their attachments straight into the database (admin SQL, bypasses RLS). */
async function seedBatches(o: Owner, count: number, createdAt?: string): Promise<string[]> {
  const sql = getAdminSql();
  const ids = Array.from({ length: count }, () => randomUUID());
  for (const id of ids) {
    await sql`
      insert into public.import_batches (id, user_id, account_id, bank, idempotency_key, row_count, imported_count, skipped_count, created_at)
      values (${id}, ${o.user.id}, ${o.accountId}, 'Nubank', ${randomUUID()}, 3, 2, 1, ${createdAt ?? sql`now()`})`;
    await sql`
      insert into public.attachments (user_id, import_batch_id, filename, mime_type, size_bytes, storage_path)
      values (${o.user.id}, ${id}, ${`seed-${id}.csv`}, 'text/csv', 10, ${`${o.user.id}/${id}/seed.csv`})`;
  }
  return ids;
}

describe('GET /imports (IMPIMP-07)', () => {
  it('lists two confirmed imports newest first with the file fields, the account nickname and the confirm counts', async () => {
    const o = await owner('Nubank pessoal');
    const first = await confirm(o, 'extrato julho.csv', ACCOUNT_CSV, [0, 1, 2]);
    const second = await confirm(o, 'fatura.csv', INVOICE_CSV, [0, 1]);

    const res = await list(o.user);
    expect(res.statusCode).toBe(200);
    const items = res.json<ListedFile[]>();
    expect(items.map((i) => i.id)).toEqual([second, first]);
    expect(items[0]).toEqual({
      id: second,
      filename: 'fatura.csv',
      mimeType: 'text/csv',
      sizeBytes: Buffer.byteLength(INVOICE_CSV),
      bank: 'Nubank',
      account: { id: o.accountId, nickname: 'Nubank pessoal' },
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      rowCount: 19,
      importedCount: 2,
      skippedCount: 17,
    });
    expect(items[1]).toMatchObject({
      id: first,
      filename: 'extrato julho.csv',
      sizeBytes: Buffer.byteLength(ACCOUNT_CSV),
      rowCount: 14,
      importedCount: 3,
      skippedCount: 11,
    });
    expect(new Date(items[0]?.createdAt ?? '').getTime()).toBeGreaterThanOrEqual(
      new Date(items[1]?.createdAt ?? '').getTime(),
    );
  });

  it('answers 200 [] to a user without batches', async () => {
    const o = await owner();
    const res = await list(o.user);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns at most 50 items without limit, at most `limit` otherwise, and accepts 100', async () => {
    const o = await owner();
    const seeded = await seedBatches(o, 52);
    expect(seeded).toHaveLength(52);

    expect(((await list(o.user)).json<ListedFile[]>())).toHaveLength(50);
    expect((await list(o.user, '?limit=7')).json<ListedFile[]>()).toHaveLength(7);
    const hundred = await list(o.user, '?limit=100');
    expect(hundred.statusCode).toBe(200);
    expect(hundred.json<ListedFile[]>()).toHaveLength(52);
  });

  it('returns only the newest batch for limit=1 when there are two', async () => {
    const o = await owner();
    await confirm(o, 'a.csv', ACCOUNT_CSV, [0]);
    const newest = await confirm(o, 'b.csv', ACCOUNT_CSV, [1]);
    const res = await list(o.user, '?limit=1');
    expect(res.statusCode).toBe(200);
    expect(res.json<ListedFile[]>().map((i) => i.id)).toEqual([newest]);
  });

  it.each(['0', '101', '1.5', 'abc', '-3'])('answers 400 validation_error for limit=%s', async (limit) => {
    const o = await owner();
    const res = await list(o.user, `?limit=${limit}`);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'validation_error' } });
  });

  it('never exposes the storage path, user_id or idempotency_key', async () => {
    const o = await owner();
    const batchId = await confirm(o, 'extrato.csv', ACCOUNT_CSV, [0]);
    const [stored] = await getAdminSql()<{ storage_path: string; idempotency_key: string }[]>`
      select a.storage_path, b.idempotency_key from public.attachments a
      join public.import_batches b on b.id = a.import_batch_id where b.id = ${batchId}`;
    const res = await list(o.user);
    const raw = res.body;
    expect(stored?.storage_path).toContain(batchId);
    expect(raw).not.toContain(stored?.storage_path);
    expect(raw).not.toContain(stored?.idempotency_key);
    expect(raw).not.toContain(o.user.id);
    for (const key of ['storage_path', 'storagePath', 'user_id', 'userId', 'idempotency_key', 'idempotencyKey']) {
      expect(raw).not.toContain(key);
    }
    expect(Object.keys(res.json<ListedFile[]>()[0] ?? {}).sort()).toEqual(
      ['account', 'bank', 'createdAt', 'filename', 'id', 'importedCount', 'mimeType', 'rowCount', 'sizeBytes', 'skippedCount'],
    );
  });

  it('orders batches with the same created_at by id descending, the same on every call', async () => {
    const o = await owner();
    const ids = await seedBatches(o, 4, '2026-07-01T12:00:00.000Z');
    const expected = [...ids].sort().reverse();
    const first = (await list(o.user)).json<ListedFile[]>().map((i) => i.id);
    const second = (await list(o.user)).json<ListedFile[]>().map((i) => i.id);
    expect(first).toEqual(expected);
    expect(second).toEqual(expected);
  });

  it('still lists a batch whose account was inactivated, with its nickname', async () => {
    const o = await owner('Conta antiga');
    const batchId = await confirm(o, 'extrato.csv', ACCOUNT_CSV, [0]);
    await getAdminSql()`update public.accounts set active = false where id = ${o.accountId}`;
    const res = await list(o.user);
    expect(res.statusCode).toBe(200);
    expect(res.json<ListedFile[]>()).toEqual([
      expect.objectContaining({ id: batchId, account: { id: o.accountId, nickname: 'Conta antiga' } }),
    ]);
  });

  it('uses the earliest attachment when a batch has more than one', async () => {
    const o = await owner();
    const batchId = await confirm(o, 'primeiro.csv', ACCOUNT_CSV, [0]);
    await getAdminSql()`
      insert into public.attachments (user_id, import_batch_id, filename, mime_type, size_bytes, storage_path, created_at)
      values (${o.user.id}, ${batchId}, 'segundo.csv', 'text/csv', 1, ${`${o.user.id}/${batchId}/segundo.csv`}, now() + interval '1 minute')`;
    const items = (await list(o.user)).json<ListedFile[]>();
    expect(items).toHaveLength(1);
    expect(items[0]?.filename).toBe('primeiro.csv');
  });

  it('does not list a batch without attachment', async () => {
    const o = await owner();
    await getAdminSql()`
      insert into public.import_batches (user_id, account_id, bank, idempotency_key, row_count, imported_count, skipped_count)
      values (${o.user.id}, ${o.accountId}, 'Nubank', ${randomUUID()}, 1, 1, 0)`;
    expect((await list(o.user)).json()).toEqual([]);
  });
});

describe('GET /imports isolation and authentication (IMPIMP-10)', () => {
  it('never lists the batches of another user, while the owner sees them', async () => {
    const a = await owner();
    const b = await owner();
    const aBatch = await confirm(a, 'extrato.csv', ACCOUNT_CSV, [0, 1]);
    const bBatch = await confirm(b, 'extrato.csv', ACCOUNT_CSV, [0]);

    expect((await list(a.user)).json<ListedFile[]>().map((i) => i.id)).toEqual([aBatch]);
    const forB = await list(b.user);
    expect(forB.json<ListedFile[]>().map((i) => i.id)).toEqual([bBatch]);
    expect(forB.body).not.toContain(aBatch);
    expect(forB.body).not.toContain(a.accountId);
  });

  it('answers 401 unauthorized without a token and with an invalid token', async () => {
    for (const res of [await list(null), await list(null, '', 'Bearer not-a-jwt')]) {
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ error: { code: 'unauthorized' } });
    }
  });
});

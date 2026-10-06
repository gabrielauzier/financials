import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createWithUser } from '../src/plugins/db.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { fixture } from './helpers/fixtures.js';
import { importState } from './helpers/imports.js';
import { multipart } from './helpers/multipart.js';
import { getLocalStack } from './helpers/stack.js';
import { removeImportObjects } from './helpers/storage.js';

let app: FastifyInstance;
let a: { user: TestUser; accountId: string };
let b: { user: TestUser; accountId: string };
let imported: { batchId: string; key: string; path: string };

const ACCOUNT_CSV = fixture('nubank_account.csv');
const SELECTIONS = JSON.stringify([{ index: 0, neutral: false }, { index: 1, neutral: false }]);

beforeAll(async () => {
  const { apiUrl, dbUrl, publishableKey } = getLocalStack();
  app = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl, supabasePublishableKey: publishableKey });
  await app.ready();
  a = await owner();
  b = await owner();
  const key = randomUUID();
  const res = await confirm(a.user, a.accountId, key);
  expect(res.statusCode).toBe(201);
  const batchId = res.json<{ batchId: string }>().batchId;
  imported = { batchId, key, path: `${a.user.id}/${batchId}/extrato.csv` };
});

afterAll(async () => {
  await app.close();
  await removeImportObjects([a.user.id, b.user.id]);
  await cleanupTestUsers();
  await closeAdminSql();
});

async function owner(): Promise<{ user: TestUser; accountId: string }> {
  const user = await createTestUser();
  const res = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { bank: 'Nubank', nickname: 'Nubank', holderNames: ['Maria'] },
  });
  expect(res.statusCode).toBe(201);
  return { user, accountId: res.json<{ id: string }>().id };
}

function preview(as: TestUser | null, accountId: string) {
  const body = multipart({ accountId }, [{ filename: 'extrato.csv', content: ACCOUNT_CSV }]);
  return app.inject({
    method: 'POST',
    url: '/imports/preview',
    headers: { ...(as ? { authorization: `Bearer ${as.token}` } : {}), ...body.headers },
    payload: body.payload,
  });
}

function confirm(as: TestUser | null, accountId: string, idempotencyKey: string = randomUUID(), authorization?: string) {
  const body = multipart({ accountId, idempotencyKey, selections: SELECTIONS }, [
    { filename: 'extrato.csv', content: ACCOUNT_CSV },
  ]);
  const auth = authorization ?? (as ? `Bearer ${as.token}` : undefined);
  return app.inject({
    method: 'POST',
    url: '/imports/confirm',
    headers: { ...(auth ? { authorization: auth } : {}), ...body.headers },
    payload: body.payload,
  });
}

/** The app's own transaction wrapper: `authenticated` role with the user's claims (RLS on). */
const asUser = <T>(user: TestUser, fn: (tx: TransactionSql) => Promise<T>): Promise<T> =>
  createWithUser(getAdminSql())({ sub: user.id, role: 'authenticated' }, fn);

describe('imports isolation between users', () => {
  it('user B cannot preview or confirm into user A\'s account (422 invalid_account) and nothing is written', async () => {
    const aBefore = await importState(a.user.id);
    const previewed = await preview(b.user, a.accountId);
    expect(previewed.statusCode).toBe(422);
    expect(previewed.json()).toEqual({ error: { code: 'invalid_account', message: expect.any(String), field: 'accountId' } });

    const confirmed = await confirm(b.user, a.accountId);
    expect(confirmed.statusCode).toBe(422);
    expect(confirmed.json()).toEqual({ error: { code: 'invalid_account', message: expect.any(String), field: 'accountId' } });

    expect(await importState(a.user.id)).toEqual(aBefore);
    expect(await importState(b.user.id)).toEqual({ transactions: 0, batches: 0, attachments: 0, objects: 0 });
  });

  it('user B reusing A\'s idempotencyKey gets a batch of their own, never A\'s summary', async () => {
    const res = await confirm(b.user, b.accountId, imported.key);
    expect(res.statusCode).toBe(201);
    expect(res.json<{ batchId: string }>().batchId).not.toBe(imported.batchId);
    expect(await importState(b.user.id)).toEqual({ transactions: 2, batches: 1, attachments: 1, objects: 1 });
  });

  it('user B cannot read A\'s batch, attachment or imported transactions (RLS)', async () => {
    const batches = await asUser(b.user, (tx) => tx`select id from public.import_batches where id = ${imported.batchId}`);
    const attachments = await asUser(b.user, (tx) =>
      tx`select id from public.attachments where import_batch_id = ${imported.batchId}`);
    const transactions = await asUser(b.user, (tx) =>
      tx`select id from public.transactions where import_batch_id = ${imported.batchId}`);
    expect([batches.length, attachments.length, transactions.length]).toEqual([0, 0, 0]);

    // Positive control: A sees them.
    const own = await asUser(a.user, (tx) => tx<{ n: number }[]>`
      select (select count(*)::int from public.import_batches where id = ${imported.batchId})
           + (select count(*)::int from public.attachments where import_batch_id = ${imported.batchId})
           + (select count(*)::int from public.transactions where import_batch_id = ${imported.batchId}) as n`);
    expect(own[0]?.n).toBe(4);
  });

  it('user B cannot read A\'s stored file through Storage', async () => {
    const { apiUrl, publishableKey } = getLocalStack();
    const read = (user: TestUser) =>
      fetch(`${apiUrl}/storage/v1/object/imports/${imported.path}`, {
        headers: { apikey: publishableKey, authorization: `Bearer ${user.token}` },
      });
    const byB = await read(b.user);
    expect(byB.status).toBe(400);
    const body = await byB.text();
    expect(JSON.parse(body)).toMatchObject({ statusCode: '404' });
    expect(body).not.toContain('Identificador');

    const byA = await read(a.user);
    expect(byA.status).toBe(200);
    expect(await byA.text()).toBe(ACCOUNT_CSV);
  });

  it('every import route answers 401 without a valid token and writes nothing', async () => {
    const before = await importState(a.user.id);
    for (const res of [
      await preview(null, a.accountId),
      await confirm(null, a.accountId),
      await confirm(null, a.accountId, randomUUID(), 'Bearer not-a-jwt'),
    ]) {
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ error: { code: 'unauthorized' } });
    }
    expect(await importState(a.user.id)).toEqual(before);
  });
});

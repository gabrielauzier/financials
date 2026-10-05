import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, type TestUser } from './helpers/db.js';
import { fixture } from './helpers/fixtures.js';
import { importState } from './helpers/imports.js';
import { multipart } from './helpers/multipart.js';
import { getLocalStack } from './helpers/stack.js';
import { removeImportObjects } from './helpers/storage.js';

let app: FastifyInstance;
const userIds: string[] = [];

const ACCOUNT_CSV = fixture('nubank_account.csv');

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

async function owner(): Promise<{ user: TestUser; accountId: string }> {
  const user = await createTestUser();
  userIds.push(user.id);
  const res = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { bank: 'Nubank', nickname: 'Nubank', holderNames: ['Maria'] },
  });
  expect(res.statusCode).toBe(201);
  return { user, accountId: res.json<{ id: string }>().id };
}

const SELECTIONS = JSON.stringify([0, 1, 2, 3, 4].map((index) => ({ index, neutral: false })));

function confirm(o: { user: TestUser; accountId: string }, idempotencyKey: string) {
  const body = multipart({ accountId: o.accountId, idempotencyKey, selections: SELECTIONS }, [
    { filename: 'extrato.csv', content: ACCOUNT_CSV },
  ]);
  return app.inject({
    method: 'POST',
    url: '/imports/confirm',
    headers: { authorization: `Bearer ${o.user.token}`, ...body.headers },
    payload: body.payload,
  });
}

const ONE_IMPORT = { transactions: 5, batches: 1, attachments: 1, objects: 1 };

describe('POST /imports/confirm idempotency', () => {
  it('a repeated confirm returns the same batchId and counts and writes or stores nothing', async () => {
    const o = await owner();
    const key = randomUUID();
    const first = await confirm(o, key);
    expect(first.statusCode).toBe(201);
    const summary = first.json<{ batchId: string; imported: number; skipped: number }>();
    expect(summary).toMatchObject({ imported: 5, skipped: 9 });
    expect(await importState(o.user.id)).toEqual(ONE_IMPORT);

    const again = await confirm(o, key);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(summary);
    expect(await importState(o.user.id)).toEqual(ONE_IMPORT);
  });

  it('concurrent confirms with one key end with exactly one batch, one set of transactions and one file', async () => {
    const o = await owner();
    const key = randomUUID();
    const replies = await Promise.all([1, 2, 3, 4, 5].map(() => confirm(o, key)));

    expect(replies.map((r) => r.statusCode).sort()).toEqual([200, 200, 200, 200, 201]);
    const batchIds = new Set(replies.map((r) => r.json<{ batchId: string }>().batchId));
    expect(batchIds.size).toBe(1);
    expect(replies.every((r) => r.json<{ imported: number }>().imported === 5)).toBe(true);
    expect(await importState(o.user.id)).toEqual(ONE_IMPORT);
  });
});

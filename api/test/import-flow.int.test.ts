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
const INVOICE_CSV = fixture('nubank_invoice.csv');
const SELECTABLE = new Set(['new', 'duplicate', 'unrecognized']);

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
}

interface PreviewRow {
  index: number;
  status: string;
  neutral: boolean;
}
interface Preview {
  rows: PreviewRow[];
  totals: Record<string, number>;
}

async function owner(): Promise<Owner> {
  const user = await createTestUser();
  userIds.push(user.id);
  const res = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { bank: 'Nubank', nickname: 'Nubank', holderNames: ['Gabriel Vasconcelos Auzier'] },
  });
  expect(res.statusCode).toBe(201);
  return { user, accountId: res.json<{ id: string }>().id };
}

async function preview(o: Owner, content: string): Promise<Preview> {
  const body = multipart({ accountId: o.accountId }, [{ filename: 'arquivo.csv', content }]);
  const res = await app.inject({
    method: 'POST',
    url: '/imports/preview',
    headers: { authorization: `Bearer ${o.user.token}`, ...body.headers },
    payload: body.payload,
  });
  expect(res.statusCode).toBe(200);
  return res.json<Preview>();
}

function confirm(o: Owner, content: string, selections: { index: number; neutral: boolean }[]) {
  const body = multipart(
    { accountId: o.accountId, idempotencyKey: randomUUID(), selections: JSON.stringify(selections) },
    [{ filename: 'arquivo.csv', content }],
  );
  return app.inject({
    method: 'POST',
    url: '/imports/confirm',
    headers: { authorization: `Bearer ${o.user.token}`, ...body.headers },
    payload: body.payload,
  });
}

/** What the preview screen sends by default: new and unrecognized rows checked, duplicates unchecked. */
const defaultSelection = (p: Preview) =>
  p.rows.filter((r) => r.status === 'new' || r.status === 'unrecognized').map((r) => ({ index: r.index, neutral: r.neutral }));

describe('import flow: preview, confirm, re-import, cancel', () => {
  it('re-importing the account file shows every importable row as duplicate and imports nothing new', async () => {
    const o = await owner();
    const first = await preview(o, ACCOUNT_CSV);
    expect(first.rows).toHaveLength(14);
    const res = await confirm(o, ACCOUNT_CSV, defaultSelection(first));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ imported: 14, skipped: 0 });
    const afterImport = await importState(o.user.id);
    expect(afterImport).toEqual({ transactions: 14, batches: 1, attachments: 1, objects: 1 });

    const again = await preview(o, ACCOUNT_CSV);
    const importable = again.rows.filter((r) => SELECTABLE.has(r.status));
    expect(importable).toHaveLength(14);
    expect(importable.every((r) => r.status === 'duplicate')).toBe(true);
    expect(again.totals).toEqual({ new: 0, duplicate: 14, ignored: 0, unrecognized: 0, invalid: 0 });

    // With every duplicate left unchecked the selection is empty: nothing to import.
    expect(defaultSelection(again)).toEqual([]);
    const second = await confirm(o, ACCOUNT_CSV, defaultSelection(again));
    expect(second.statusCode).toBe(422);
    expect(second.json()).toMatchObject({ error: { code: 'validation_error', field: 'selections' } });
    expect(await importState(o.user.id)).toEqual(afterImport);
  });

  it('re-importing the invoice shows all 18 purchases as duplicate and keeps the 19th row ignored', async () => {
    const o = await owner();
    const first = await preview(o, INVOICE_CSV);
    expect(first.totals).toEqual({ new: 18, duplicate: 0, ignored: 1, unrecognized: 0, invalid: 0 });
    const res = await confirm(o, INVOICE_CSV, defaultSelection(first));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ imported: 18, skipped: 1 });
    const afterImport = await importState(o.user.id);
    expect(afterImport).toEqual({ transactions: 18, batches: 1, attachments: 1, objects: 1 });

    const again = await preview(o, INVOICE_CSV);
    expect(again.totals).toEqual({ new: 0, duplicate: 18, ignored: 1, unrecognized: 0, invalid: 0 });
    expect(again.rows.filter((r) => r.status === 'ignored').map((r) => r.index)).toEqual([11]);

    const second = await confirm(o, INVOICE_CSV, defaultSelection(again));
    expect(second.statusCode).toBe(422);
    expect(await importState(o.user.id)).toEqual(afterImport);
  });

  it('cancelling after the preview writes nothing: no batch, attachment, transaction or file', async () => {
    const o = await owner();
    expect((await preview(o, ACCOUNT_CSV)).rows).toHaveLength(14);
    expect((await preview(o, INVOICE_CSV)).rows).toHaveLength(19);
    expect(await importState(o.user.id)).toEqual({ transactions: 0, batches: 0, attachments: 0, objects: 0 });
  });
});

import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { fixture } from './helpers/fixtures.js';
import { importState } from './helpers/imports.js';
import { multipart } from './helpers/multipart.js';
import { getLocalStack } from './helpers/stack.js';
import { removeImportObjects } from './helpers/storage.js';

const ACCOUNT_CSV = fixture('nubank_account.csv');
const INVOICE_CSV = fixture('nubank_invoice.csv');

type StorageMode = 'forward' | 'http500' | 'drop';

/**
 * A stand-in for the Supabase URL the app is built with: Auth (JWKS) is always forwarded to the real
 * local stack, Storage is forwarded, answered with HTTP 500 or cut off, and every Storage request is recorded.
 */
class StackProxy {
  mode: StorageMode = 'forward';
  readonly storageRequests: string[] = [];
  private server: Server | undefined;
  url = '';

  async start(): Promise<void> {
    const { apiUrl } = getLocalStack();
    this.server = createServer((req, res) => {
      void (async () => {
        const isStorage = (req.url ?? '').startsWith('/storage/');
        if (isStorage) {
          this.storageRequests.push(`${req.method} ${req.url}`);
          if (this.mode === 'drop') return void req.socket.destroy();
          if (this.mode === 'http500') {
            res.statusCode = 500;
            return void res.end('{"message":"internal"}');
          }
        }
        const headers: Record<string, string> = {};
        for (const [name, value] of Object.entries((req as IncomingMessage).headers)) {
          if (name !== 'host' && typeof value === 'string') headers[name] = value;
        }
        const upstream = await fetch(`${apiUrl}${req.url}`, { method: req.method ?? 'GET', headers });
        res.statusCode = upstream.status;
        upstream.headers.forEach((value, name) => {
          if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(name)) {
            res.setHeader(name, value);
          }
        });
        res.end(Buffer.from(await upstream.arrayBuffer()));
      })();
    });
    await new Promise<void>((resolve) => this.server?.listen(0, '127.0.0.1', resolve));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }
}

let app: FastifyInstance;
let proxied: FastifyInstance;
let unconfigured: FastifyInstance;
const proxy = new StackProxy();
const userIds: string[] = [];

beforeAll(async () => {
  const { apiUrl, dbUrl, publishableKey } = getLocalStack();
  await proxy.start();
  app = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl, supabasePublishableKey: publishableKey });
  proxied = buildApp({ supabaseUrl: proxy.url, databaseUrl: dbUrl, supabasePublishableKey: publishableKey });
  unconfigured = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl });
  await Promise.all([app.ready(), proxied.ready(), unconfigured.ready()]);
});

afterAll(async () => {
  await Promise.all([app.close(), proxied.close(), unconfigured.close()]);
  await proxy.stop();
  await removeImportObjects(userIds);
  await cleanupTestUsers();
  await closeAdminSql();
});

interface Owner {
  user: TestUser;
  accountId: string;
}

async function owner(): Promise<Owner> {
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

async function confirm(
  o: Owner,
  content: string | Buffer = ACCOUNT_CSV,
  filename = 'extrato.csv',
  indexes: number[] = [0],
): Promise<string> {
  const body = multipart(
    { accountId: o.accountId, idempotencyKey: randomUUID(), selections: JSON.stringify(indexes.map((index) => ({ index, neutral: false }))) },
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

function download(user: TestUser | null, id: string, target: FastifyInstance = app, authorization?: string) {
  const auth = authorization ?? (user ? `Bearer ${user.token}` : undefined);
  return target.inject({
    method: 'GET',
    url: `/imports/${id}/file`,
    headers: auth ? { authorization: auth } : {},
  });
}

const storagePathOf = async (batchId: string): Promise<string> => {
  const [row] = await getAdminSql()<{ storage_path: string }[]>`
    select storage_path from public.attachments where import_batch_id = ${batchId}`;
  return (row as { storage_path: string }).storage_path;
};

const NOT_FOUND = { error: { code: 'not_found', message: expect.any(String) } };

describe('GET /imports/:id/file (IMPIMP-08)', () => {
  it('returns the uploaded bytes with the stored mime type, the original filename and no-store headers', async () => {
    const o = await owner();
    const content = Buffer.from(ACCOUNT_CSV, 'utf8');
    const id = await confirm(o, content, 'extrato julho.csv');
    const res = await download(o.user, id);
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.equals(content)).toBe(true);
    expect(res.headers['content-type']).toBe('text/csv');
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="extrato julho.csv"; filename*=UTF-8''extrato%20julho.csv`,
    );
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-length']).toBe(String(content.length));
  });

  it('accepts a lowercase bearer scheme and still reaches Storage with the bare token', async () => {
    const o = await owner();
    const id = await confirm(o, ACCOUNT_CSV, 'extrato.csv');
    const res = await download(null, id, app, `bearer ${o.user.token}`);
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.toString('utf8')).toBe(ACCOUNT_CSV);
  });

  it('downloads the earliest attachment when a batch has more than one', async () => {
    const o = await owner();
    const id = await confirm(o, ACCOUNT_CSV, 'primeiro.csv');
    // The later attachment points at an object that does not exist: picking it would answer 404.
    await getAdminSql()`
      insert into public.attachments (user_id, import_batch_id, filename, mime_type, size_bytes, storage_path, created_at)
      values (${o.user.id}, ${id}, 'segundo.csv', 'text/csv', 1, ${`${o.user.id}/${id}/segundo.csv`}, now() + interval '1 minute')`;
    const res = await download(o.user, id);
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.toString('utf8')).toBe(ACCOUNT_CSV);
    expect(res.headers['content-disposition']).toContain('primeiro.csv');
  });

  it('answers a stored name with accents, a quote and a line break with a valid header', async () => {
    const o = await owner();
    const id = await confirm(o);
    const stored = 'extrato "março";\r\nX-Evil: 1.csv';
    await getAdminSql()`update public.attachments set filename = ${stored} where import_batch_id = ${id}`;
    const res = await download(o.user, id);
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.toString('utf8')).toBe(ACCOUNT_CSV);
    const header = String(res.headers['content-disposition']);
    expect(header).toMatch(/^attachment; filename="[\x20-\x7e]*"; filename\*=UTF-8''[A-Za-z0-9%._~!-]*$/);
    const fallback = /filename="([^"]*)"/.exec(header)?.[1] ?? '';
    expect(fallback).not.toMatch(/["\\/;\r\n]/);
    expect(decodeURIComponent(/filename\*=UTF-8''(.*)$/.exec(header)?.[1] ?? '')).toBe('extrato "março";X-Evil: 1.csv');
    expect(res.headers['x-evil']).toBeUndefined();
  });

  it.each(['not a mime', 'text/csv; charset=utf-8', 'x'])(
    'answers application/octet-stream for the stored mime type %j',
    async (mime) => {
      const o = await owner();
      const id = await confirm(o);
      await getAdminSql()`update public.attachments set mime_type = ${mime} where import_batch_id = ${id}`;
      const res = await download(o.user, id);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/octet-stream');
    },
  );

  it('answers the same 404 not_found for a non-UUID, an unknown and another user\'s id, without asking Storage', async () => {
    const a = await owner();
    const b = await owner();
    const aBatch = await confirm(a);
    proxy.mode = 'forward';
    const before = proxy.storageRequests.length;

    const responses = [];
    for (const id of ['not-a-uuid', randomUUID(), aBatch]) {
      responses.push(await download(b.user, id, proxied));
    }
    for (const res of responses) {
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual(NOT_FOUND);
    }
    expect(new Set(responses.map((r) => r.body)).size).toBe(1);
    expect(proxy.storageRequests.length).toBe(before);
    expect(responses.map((r) => r.body).join('')).not.toContain('Identificador');
  });

  it('answers 404 not_found when the object is gone from Storage', async () => {
    const o = await owner();
    const id = await confirm(o);
    const path = await storagePathOf(id);
    const { apiUrl, serviceRoleKey } = getLocalStack();
    const removed = await fetch(`${apiUrl}/storage/v1/object/imports`, {
      method: 'DELETE',
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: [path] }),
    });
    expect(removed.ok).toBe(true);
    const res = await download(o.user, id);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual(NOT_FOUND);
    expect(res.body).not.toContain(path);
  });

  it.each<[string, StorageMode]>([
    ['Storage answers HTTP 500', 'http500'],
    ['Storage is unreachable', 'drop'],
  ])('answers 502 storage_error without URL, token, key or path when %s', async (_label, mode) => {
    const o = await owner();
    const id = await confirm(o);
    const path = await storagePathOf(id);
    const { publishableKey } = getLocalStack();
    proxy.mode = mode;
    try {
      const res = await download(o.user, id, proxied);
      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual({ error: { code: 'storage_error', message: expect.any(String) } });
      const everything = res.body + JSON.stringify(res.headers);
      for (const secret of [proxy.url, `127.0.0.1:${new URL(proxy.url).port}`, o.user.token, publishableKey, path, o.user.id]) {
        expect(everything).not.toContain(secret);
      }
    } finally {
      proxy.mode = 'forward';
    }
  });

  it('answers 503 storage_not_configured without a publishable key, before looking at the id', async () => {
    const o = await owner();
    const id = await confirm(o);
    for (const target of [id, randomUUID(), 'not-a-uuid']) {
      const res = await download(o.user, target, unconfigured);
      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({ error: { code: 'storage_not_configured' } });
    }
  });

  it('never puts the storage path, the Storage URL or the project key in a body or header', async () => {
    const o = await owner();
    const id = await confirm(o);
    const path = await storagePathOf(id);
    const { apiUrl, publishableKey, serviceRoleKey } = getLocalStack();
    const ok = await download(o.user, id);
    const missing = await download(o.user, randomUUID());
    const notConfigured = await download(o.user, id, unconfigured);
    for (const res of [ok, missing, notConfigured]) {
      const text = JSON.stringify(res.headers) + (res === ok ? '' : res.body);
      for (const secret of [path, `/storage/v1`, apiUrl, publishableKey, serviceRoleKey, o.user.token]) {
        expect(text).not.toContain(secret);
      }
    }
    expect(ok.rawPayload.toString('utf8')).not.toContain(path);
  });
});

describe('GET /imports/:id/file isolation and authentication (IMPIMP-10)', () => {
  it('lets user B neither read A\'s file nor learn it exists, and A still downloads its own bytes', async () => {
    const a = await owner();
    const b = await owner();
    const aBatch = await confirm(a, ACCOUNT_CSV, 'extrato.csv');
    const bBefore = await importState(b.user.id);

    const byB = await download(b.user, aBatch);
    expect(byB.statusCode).toBe(404);
    expect(byB.json()).toEqual(NOT_FOUND);
    expect(byB.body).not.toContain('Identificador');
    expect(await importState(b.user.id)).toEqual(bBefore);

    const byA = await download(a.user, aBatch);
    expect(byA.statusCode).toBe(200);
    expect(byA.rawPayload.toString('utf8')).toBe(ACCOUNT_CSV);
  });

  it('serves each user their own upload when two batches share the filename', async () => {
    const a = await owner();
    const b = await owner();
    const aBatch = await confirm(a, ACCOUNT_CSV, 'extrato.csv');
    const bBatch = await confirm(b, INVOICE_CSV, 'extrato.csv');
    expect((await download(a.user, aBatch)).rawPayload.toString('utf8')).toBe(ACCOUNT_CSV);
    expect((await download(b.user, bBatch)).rawPayload.toString('utf8')).toBe(INVOICE_CSV);
    expect((await download(a.user, bBatch)).statusCode).toBe(404);
    expect((await download(b.user, aBatch)).statusCode).toBe(404);
  });

  it('answers 401 unauthorized without a token and with an invalid token, without asking Storage', async () => {
    const o = await owner();
    const id = await confirm(o);
    const before = proxy.storageRequests.length;
    for (const res of [
      await download(null, id, proxied),
      await download(null, id, proxied, 'Bearer not-a-jwt'),
      await download(null, 'not-a-uuid', proxied),
    ]) {
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ error: { code: 'unauthorized' } });
    }
    expect(proxy.storageRequests.length).toBe(before);
  });
});

describe('reimport round trip: the downloaded file through the normal preview (IMPIMP-09)', () => {
  it('previews every confirmed row as duplicate, with the row count of the file', async () => {
    const o = await owner();
    const all = [...Array(14).keys()];
    const id = await confirm(o, ACCOUNT_CSV, 'extrato.csv', all);
    const downloaded = await download(o.user, id);
    expect(downloaded.statusCode).toBe(200);

    const body = multipart({ accountId: o.accountId }, [{ filename: 'extrato.csv', content: downloaded.rawPayload }]);
    const res = await app.inject({
      method: 'POST',
      url: '/imports/preview',
      headers: { authorization: `Bearer ${o.user.token}`, ...body.headers },
      payload: body.payload,
    });
    expect(res.statusCode).toBe(200);
    const preview = res.json<{ rows: { status: string }[]; totals: Record<string, number> }>();
    expect(preview.rows).toHaveLength(14);
    expect(preview.rows.every((r) => r.status === 'duplicate')).toBe(true);
    expect(preview.totals).toEqual({ new: 0, duplicate: 14, ignored: 0, unrecognized: 0, invalid: 0 });
  });

  it('keeps a row skipped in the original import as new', async () => {
    const o = await owner();
    const id = await confirm(o, ACCOUNT_CSV, 'extrato.csv', [0, 1]);
    const downloaded = await download(o.user, id);
    const body = multipart({ accountId: o.accountId }, [{ filename: 'extrato.csv', content: downloaded.rawPayload }]);
    const res = await app.inject({
      method: 'POST',
      url: '/imports/preview',
      headers: { authorization: `Bearer ${o.user.token}`, ...body.headers },
      payload: body.payload,
    });
    const { rows } = res.json<{ rows: { index: number; status: string }[] }>();
    expect(rows.filter((r) => r.status === 'duplicate').map((r) => r.index)).toEqual([0, 1]);
    expect(rows.filter((r) => r.status === 'new')).toHaveLength(12);
  });
});

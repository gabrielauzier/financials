import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { importState } from './helpers/imports.js';
import { multipart } from './helpers/multipart.js';
import { getLocalStack } from './helpers/stack.js';
import { removeImportObjects } from './helpers/storage.js';

// Temporary database objects that inject real failures; created here and dropped in afterAll.
const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
const FAIL_FUNCTION = `test_fail_import_${suffix}`;
const FAIL_TRIGGER = `test_fail_import_${suffix}`;
const BLOCK_POLICY = `test_block_upload_${suffix}`;
const FAILING_NAME = `FALHA FORCADA ${suffix}`;
const BLOCKED_FILENAME = `bloqueado-${suffix}.csv`;

let app: FastifyInstance;
const userIds: string[] = [];

beforeAll(async () => {
  const { apiUrl, dbUrl, publishableKey } = getLocalStack();
  app = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl, supabasePublishableKey: publishableKey });
  await app.ready();
  const sql = getAdminSql();
  // Raises on the row named FAILING_NAME, but only once the user's file is already in Storage:
  // a failure here therefore proves the upload happened before the transaction.
  await sql.unsafe(`
    create function public.${FAIL_FUNCTION}() returns trigger
    language plpgsql security definer set search_path = '' as $$
    begin
      if new.name = '${FAILING_NAME}' and exists (
        select 1 from storage.objects
        where bucket_id = 'imports' and split_part(name, '/', 1) = new.user_id::text
      ) then
        raise exception 'forced import failure';
      end if;
      return new;
    end $$`);
  await sql.unsafe(`
    create trigger ${FAIL_TRIGGER} before insert on public.transactions
    for each row execute function public.${FAIL_FUNCTION}()`);
  // Makes Storage itself refuse one file name, like any policy violation.
  await sql.unsafe(`
    create policy ${BLOCK_POLICY} on storage.objects as restrictive for insert to authenticated
    with check (name not like '%/${BLOCKED_FILENAME}')`);
});

afterAll(async () => {
  await app.close();
  const sql = getAdminSql();
  await sql.unsafe(`drop trigger if exists ${FAIL_TRIGGER} on public.transactions`);
  await sql.unsafe(`drop function if exists public.${FAIL_FUNCTION}()`);
  await sql.unsafe(`drop policy if exists ${BLOCK_POLICY} on storage.objects`);
  const [left] = await sql<{ n: number }[]>`
    select (select count(*)::int from pg_trigger where tgname = ${FAIL_TRIGGER})
         + (select count(*)::int from pg_proc where proname = ${FAIL_FUNCTION})
         + (select count(*)::int from pg_policy where polname = ${BLOCK_POLICY}) as n`;
  expect(left?.n).toBe(0);
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

function confirm(o: { user: TestUser; accountId: string }, content: string, filename: string) {
  const body = multipart(
    {
      accountId: o.accountId,
      idempotencyKey: randomUUID(),
      selections: JSON.stringify([{ index: 0, neutral: false }, { index: 1, neutral: false }]),
    },
    [{ filename, content }],
  );
  return app.inject({
    method: 'POST',
    url: '/imports/confirm',
    headers: { authorization: `Bearer ${o.user.token}`, ...body.headers },
    payload: body.payload,
  });
}

const NOTHING = { transactions: 0, batches: 0, attachments: 0, objects: 0 };

describe('POST /imports/confirm atomicity', () => {
  it('a failed insert rolls back everything and removes the uploaded file', async () => {
    const o = await owner();
    const content = `date,title,amount\n2026-09-05,Petz Digital,"87,60"\n2026-09-06,${FAILING_NAME},"10,00"\n`;
    const res = await confirm(o, content, 'fatura.csv');
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'internal_error', message: 'Internal server error' } });
    expect(await importState(o.user.id)).toEqual(NOTHING);
  });

  it('a failed upload writes nothing', async () => {
    const o = await owner();
    const content = 'date,title,amount\n2026-09-05,Petz Digital,"87,60"\n2026-09-06,Feira,"10,00"\n';
    const res = await confirm(o, content, BLOCKED_FILENAME);
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: { code: 'storage_error' } });
    expect(await importState(o.user.id)).toEqual(NOTHING);

    // Positive control: the same rows with another file name import normally.
    expect((await confirm(o, content, 'fatura.csv')).statusCode).toBe(201);
    expect(await importState(o.user.id)).toEqual({ transactions: 2, batches: 1, attachments: 1, objects: 1 });
  });
});

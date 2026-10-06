import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { cleanupTestUsers, closeAdminSql, createTestUser as createUser, getAdminSql, type TestUser } from './helpers/db.js';
import { fixture } from './helpers/fixtures.js';
import { importState } from './helpers/imports.js';
import { multipart } from './helpers/multipart.js';
import { getLocalStack } from './helpers/stack.js';
import { removeImportObjects } from './helpers/storage.js';

let app: FastifyInstance;
const userIds: string[] = [];

const ACCOUNT_CSV = fixture('nubank_account.csv');
const INVOICE_CSV = fixture('nubank_invoice.csv');
const HOLDER = 'Gabriel Vasconcelos Auzier';

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

async function owner(): Promise<Owner> {
  const user = await createUser();
  userIds.push(user.id);
  const res = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { bank: 'Nubank', nickname: 'Nubank', holderNames: [HOLDER] },
  });
  expect(res.statusCode).toBe(201);
  return { user, accountId: res.json<{ id: string }>().id };
}

interface ConfirmInput {
  content?: string | Buffer;
  filename?: string;
  selections?: unknown;
  idempotencyKey?: string;
  accountId?: string;
  tz?: string;
}

function confirm(o: Owner, input: ConfirmInput = {}, target: FastifyInstance = app) {
  const selections = typeof input.selections === 'string' ? input.selections : JSON.stringify(input.selections ?? []);
  const body = multipart(
    { accountId: input.accountId ?? o.accountId, idempotencyKey: input.idempotencyKey ?? randomUUID(), selections },
    [{ filename: input.filename ?? 'extrato.csv', content: input.content ?? ACCOUNT_CSV }],
  );
  return target.inject({
    method: 'POST',
    url: '/imports/confirm',
    headers: {
      authorization: `Bearer ${o.user.token}`,
      ...(input.tz === undefined ? {} : { 'x-timezone': input.tz }),
      ...body.headers,
    },
    payload: body.payload,
  });
}

const pick = (...indexes: number[]) => indexes.map((index) => ({ index, neutral: false }));

interface StoredTx {
  name: string;
  type: string;
  amount: string;
  occurred_at: string;
  payment_method: string;
  identifier: string | null;
  counterparty_document: string | null;
  counterparty_bank: string | null;
  neutral: boolean;
  category_key: string;
  import_batch_id: string | null;
  account_id: string;
}

async function storedTransactions(userId: string): Promise<StoredTx[]> {
  return getAdminSql()<StoredTx[]>`
    select t.name, t.type, t.amount::text as amount, to_json(t.occurred_at)#>>'{}' as occurred_at,
           t.payment_method, t.identifier, t.counterparty_document, t.counterparty_bank, t.neutral,
           c.key as category_key, t.import_batch_id, t.account_id
    from public.transactions t join public.categories c on c.id = t.category_id
    where t.user_id = ${userId}
    order by t.occurred_at, t.identifier, t.name`;
}

async function download(user: TestUser, path: string): Promise<{ status: number; body: Buffer }> {
  const { apiUrl, publishableKey } = getLocalStack();
  const res = await fetch(`${apiUrl}/storage/v1/object/imports/${path}`, {
    headers: { apikey: publishableKey, authorization: `Bearer ${user.token}` },
  });
  return { status: res.status, body: Buffer.from(await res.arrayBuffer()) };
}

const toUtc = (iso: string) => new Date(iso).toISOString();

describe('POST /imports/confirm', () => {
  it('inserts only the selected rows, linked to the batch, with the parsed fields', async () => {
    const o = await owner();
    const res = await confirm(o, { selections: pick(0, 1, 2) });
    expect(res.statusCode).toBe(201);
    const { batchId, imported, skipped } = res.json<{ batchId: string; imported: number; skipped: number }>();
    expect(batchId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect({ imported, skipped }).toEqual({ imported: 3, skipped: 11 });

    const rows = await storedTransactions(o.user.id);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.import_batch_id === batchId && r.account_id === o.accountId)).toBe(true);
    const byIdentifier = new Map(rows.map((r) => [r.identifier, r]));
    expect(byIdentifier.get('6a442c8d-0f0c-471a-8aba-ca4523ca8ebb')).toMatchObject({
      name: 'Débito em conta', type: 'Expense', amount: '82.32', payment_method: 'DebitCard',
      category_key: 'Uncategorized', counterparty_document: null, counterparty_bank: null, neutral: false,
    });
    expect(byIdentifier.get('6a46bc6a-5768-4e2c-8181-ebf0072c0f16')).toMatchObject({
      name: 'Dinheiro guardado com resgate planejado', type: 'Expense', amount: '6300.74',
      payment_method: 'BankTransfer', category_key: 'Investments',
    });
    expect(byIdentifier.get('6a46ebe4-6e90-4411-97e9-2c5185394f9a')).toMatchObject({
      name: 'MERCADO AUTO SOLUCOES PUBLICIDADE E TECNOLOGIA LTDA', type: 'Income', amount: '8608.00',
      payment_method: 'PIX', category_key: 'Uncategorized',
      counterparty_document: '41.460.383/0001-68', counterparty_bank: 'BCO SANTANDER (BRASIL) S.A. (0033)',
    });
  });

  it('skips unchecked duplicates and imports a duplicate the user selects', async () => {
    const o = await owner();
    // First import: rows 0 and 1. Re-confirming the same file makes both duplicates.
    expect((await confirm(o, { selections: pick(0, 1) })).statusCode).toBe(201);

    const res = await confirm(o, { selections: pick(0, 2) }); // 0 is a duplicate the user re-selects; 1 stays unchecked
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ imported: 2, skipped: 12 });

    const rows = await storedTransactions(o.user.id);
    const count = (identifier: string) => rows.filter((r) => r.identifier === identifier).length;
    expect(count('6a442c8d-0f0c-471a-8aba-ca4523ca8ebb')).toBe(2); // re-selected duplicate imported
    expect(count('6a46bc6a-5768-4e2c-8181-ebf0072c0f16')).toBe(1); // unchecked duplicate skipped
    expect(count('6a46ebe4-6e90-4411-97e9-2c5185394f9a')).toBe(1);
    expect(rows).toHaveLength(4);
  });

  it('stores the per-row neutral choice, overriding the suggestion either way', async () => {
    const o = await owner();
    // Row 3 is suggested neutral (holder name); row 2 is not.
    const res = await confirm(o, { selections: [{ index: 3, neutral: false }, { index: 2, neutral: true }, { index: 4, neutral: true }] });
    expect(res.statusCode).toBe(201);
    const neutral = new Map((await storedTransactions(o.user.id)).map((r) => [r.identifier, r.neutral]));
    expect(neutral.get('6a4c0d62-92f3-46a0-ad4a-955371aa5d28')).toBe(false); // index 3
    expect(neutral.get('6a46ebe4-6e90-4411-97e9-2c5185394f9a')).toBe(true); // index 2
    expect(neutral.get('6a4efd7c-db52-4476-b4e7-303f42a5baa6')).toBe(true); // index 4
  });

  it('records the batch counts and the attachment, and the stored file equals the upload', async () => {
    const o = await owner();
    const key = randomUUID();
    const content = Buffer.from(INVOICE_CSV, 'utf8');
    const res = await confirm(o, { content, filename: 'fatura.csv', idempotencyKey: key, selections: pick(0, 1, 2, 18) });
    expect(res.statusCode).toBe(201);
    const { batchId } = res.json<{ batchId: string }>();
    expect(res.json()).toEqual({ batchId, imported: 4, skipped: 15 });

    const [batch] = await getAdminSql()`
      select account_id, bank, idempotency_key, row_count, imported_count, skipped_count
      from public.import_batches where id = ${batchId} and user_id = ${o.user.id}`;
    expect(batch).toEqual({
      account_id: o.accountId, bank: 'Nubank', idempotency_key: key, row_count: 19, imported_count: 4, skipped_count: 15,
    });
    const attachments = await getAdminSql()`
      select filename, mime_type, size_bytes, storage_path from public.attachments
      where import_batch_id = ${batchId} and user_id = ${o.user.id}`;
    expect(attachments).toEqual([{
      filename: 'fatura.csv', mime_type: 'text/csv', size_bytes: content.length,
      storage_path: `${o.user.id}/${batchId}/fatura.csv`,
    }]);

    const stored = await download(o.user, `${o.user.id}/${batchId}/fatura.csv`);
    expect(stored.status).toBe(200);
    expect(stored.body.equals(content)).toBe(true);
    expect((await storedTransactions(o.user.id)).every((r) => r.import_batch_id === batchId)).toBe(true);
  });

  it('stores occurred_at as local midnight of the row date in the request time zone', async () => {
    const o = await owner();
    expect((await confirm(o, { selections: pick(0) })).statusCode).toBe(201); // default America/Sao_Paulo
    const ny = await owner();
    expect((await confirm(ny, { selections: pick(0), tz: 'America/New_York' })).statusCode).toBe(201);
    const tokyo = await owner();
    expect((await confirm(tokyo, { selections: pick(0), tz: 'Asia/Tokyo' })).statusCode).toBe(201);

    // Row 0 is dated 02/07/2026.
    expect(toUtc((await storedTransactions(o.user.id))[0]?.occurred_at ?? '')).toBe('2026-07-02T03:00:00.000Z');
    expect(toUtc((await storedTransactions(ny.user.id))[0]?.occurred_at ?? '')).toBe('2026-07-02T04:00:00.000Z');
    expect(toUtc((await storedTransactions(tokyo.user.id))[0]?.occurred_at ?? '')).toBe('2026-07-01T15:00:00.000Z');
  });

  it('uses the real local midnight on a day whose midnight does not exist (DST gap)', async () => {
    // America/Santiago moves 00:00 → 01:00 on 2026-09-06; the day starts at 01:00 local (04:00Z).
    const o = await owner();
    const content = 'date,title,amount\n2026-09-06,Mercado,"10,00"\n';
    expect((await confirm(o, { content, selections: pick(0), tz: 'America/Santiago' })).statusCode).toBe(201);
    expect(toUtc((await storedTransactions(o.user.id))[0]?.occurred_at ?? '')).toBe('2026-09-06T04:00:00.000Z');
  });

  it.each([
    ['an ignored row', INVOICE_CSV, 11],
    ['an invalid row', 'date,title,amount\n2026-02-31,Mercado,"10,00"\n2026-09-01,Feira,"5,00"\n', 0],
    ['an unknown index', ACCOUNT_CSV, 14],
  ])('rejects selecting %s with 422 invalid_selection and writes nothing', async (_label, content, index) => {
    const o = await owner();
    const res = await confirm(o, { content, selections: [{ index: 0 === index ? 1 : 0, neutral: false }, { index, neutral: false }] });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { code: 'invalid_selection', message: expect.any(String), field: 'selections' } });
    expect(await importState(o.user.id)).toEqual({ transactions: 0, batches: 0, attachments: 0, objects: 0 });
  });

  it.each([
    ['malformed JSON', '[{"index":0,'],
    ['not an array', '{"index":0,"neutral":false}'],
    ['an empty selection', '[]'],
    ['a non-integer index', '[{"index":1.5,"neutral":false}]'],
    ['a string index', '[{"index":"0","neutral":false}]'],
    ['a negative index', '[{"index":-1,"neutral":false}]'],
    ['a non-boolean neutral', '[{"index":0,"neutral":"true"}]'],
    ['a missing neutral', '[{"index":0}]'],
    ['a repeated index', '[{"index":0,"neutral":false},{"index":0,"neutral":true}]'],
  ])('rejects %s in selections with 422 validation_error and writes nothing', async (_label, selections) => {
    const o = await owner();
    const res = await confirm(o, { selections });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { code: 'validation_error', message: expect.any(String), field: 'selections' } });
    expect(await importState(o.user.id)).toEqual({ transactions: 0, batches: 0, attachments: 0, objects: 0 });
  });

  it('validates the other fields: idempotencyKey uuid (422), required fields (400), account (422)', async () => {
    const o = await owner();
    const badKey = await confirm(o, { idempotencyKey: 'abc', selections: pick(0) });
    expect(badKey.statusCode).toBe(422);
    expect(badKey.json()).toMatchObject({ error: { code: 'validation_error', field: 'idempotencyKey' } });

    for (const missing of ['accountId', 'idempotencyKey', 'selections']) {
      const fields: Record<string, string> = {
        accountId: o.accountId, idempotencyKey: randomUUID(), selections: JSON.stringify(pick(0)),
      };
      delete fields[missing];
      const body = multipart(fields, [{ filename: 'extrato.csv', content: ACCOUNT_CSV }]);
      const res = await app.inject({
        method: 'POST', url: '/imports/confirm',
        headers: { authorization: `Bearer ${o.user.token}`, ...body.headers }, payload: body.payload,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'validation_error', field: missing } });
    }

    await getAdminSql()`update public.accounts set active = false where id = ${o.accountId}`;
    const inactive = await confirm(o, { selections: pick(0) });
    expect(inactive.statusCode).toBe(422);
    expect(inactive.json()).toMatchObject({ error: { code: 'invalid_account', field: 'accountId' } });
    expect(await importState(o.user.id)).toEqual({ transactions: 0, batches: 0, attachments: 0, objects: 0 });
  });

  it('answers 503 storage_not_configured and writes nothing when the server has no publishable key', async () => {
    const { apiUrl, dbUrl } = getLocalStack();
    const bare = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl });
    try {
      const o = await owner();
      const res = await confirm(o, { selections: pick(0) }, bare);
      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({ error: { code: 'storage_not_configured' } });
      expect(await importState(o.user.id)).toEqual({ transactions: 0, batches: 0, attachments: 0, objects: 0 });
    } finally {
      await bare.close();
    }
  });
});

describe('description and extracted names (IMPFIX-06, IMPFIX-08)', () => {
  const HEADER = 'Data,Valor,Identificador,Descrição';
  const SANITIZED = fixture('nubank_statement_sanitized.csv');

  async function storedDescriptions(userId: string) {
    return getAdminSql()<{ name: string; description: string | null; chars: number | null }[]>`
      select name, description, char_length(description)::int as chars
      from public.transactions where user_id = ${userId} order by name`;
  }

  it('stores the original text (spaces collapsed) as description, keeps the extracted name and returns both from GET /transactions', async () => {
    const o = await owner();
    const text = `${HEADER}\n02/09/2026,-12.50,id-a,Compra no débito -  Padaria   Estrela Azul\n03/09/2026,5.00,id-b,Estorno - Compra no débito - RIDEX *VIAGEM\n`;
    const res = await confirm(o, { content: text, selections: pick(0, 1) });
    expect(res.statusCode).toBe(201);
    expect(await storedDescriptions(o.user.id)).toEqual([
      { name: 'Padaria Estrela Azul', description: 'Compra no débito - Padaria Estrela Azul', chars: 39 },
      { name: 'RIDEX *VIAGEM', description: 'Estorno - Compra no débito - RIDEX *VIAGEM', chars: 42 },
    ]);
    const listed = await app.inject({
      method: 'GET',
      url: '/transactions',
      headers: { authorization: `Bearer ${o.user.token}` },
    });
    const items = listed.json<{ items: { name: string; description: string | null }[] }>().items;
    expect(items.map((t) => [t.name, t.description]).sort()).toEqual([
      ['Padaria Estrela Azul', 'Compra no débito - Padaria Estrela Azul'],
      ['RIDEX *VIAGEM', 'Estorno - Compra no débito - RIDEX *VIAGEM'],
    ]);
  });

  it('stores exactly 500 code points for a 600-character line and the whole text for 500, with the name intact', async () => {
    const o = await owner();
    const long = `Compra no débito - ${'L'.repeat(600)}`;
    const exact = `Compra no débito - ${'M'.repeat(481)}`;
    const text = `${HEADER}\n02/09/2026,-1.00,id-long,${long}\n03/09/2026,-2.00,id-exact,${exact}\n`;
    expect((await confirm(o, { content: text, selections: pick(0, 1) })).statusCode).toBe(201);
    const rows = await storedDescriptions(o.user.id);
    const bySize = Object.fromEntries(rows.map((r) => [r.name.charAt(0), r]));
    expect(bySize.L).toMatchObject({ chars: 500, description: long.slice(0, 500), name: 'L'.repeat(600) });
    expect(bySize.M).toMatchObject({ chars: 500, description: exact, name: 'M'.repeat(481) });
  });

  it('marks all 96 rows of the sanitized statement as duplicate when it is previewed again after the confirm', async () => {
    const o = await owner();
    const first = await confirm(o, { content: SANITIZED, selections: pick(...Array(96).keys()) });
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ imported: 96, skipped: 0 });
    const body = multipart({ accountId: o.accountId }, [{ filename: 'extrato.csv', content: SANITIZED }]);
    const again = await app.inject({
      method: 'POST',
      url: '/imports/preview',
      headers: { authorization: `Bearer ${o.user.token}`, ...body.headers },
      payload: body.payload,
    });
    expect(again.statusCode).toBe(200);
    const preview = again.json<{ rows: { status: string }[]; totals: Record<string, number> }>();
    expect(preview.rows).toHaveLength(96);
    expect(preview.totals).toEqual({ new: 0, duplicate: 96, ignored: 0, unrecognized: 0, invalid: 0 });
  });
});

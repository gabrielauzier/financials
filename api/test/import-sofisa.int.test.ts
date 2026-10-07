import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { fixture } from './helpers/fixtures.js';
import { importState } from './helpers/imports.js';
import { multipart } from './helpers/multipart.js';
import { getLocalStack } from './helpers/stack.js';
import { removeImportObjects } from './helpers/storage.js';

let app: FastifyInstance;

const CSV = fixture('sofisa_statement_sanitized.csv');
const TSV = fixture('sofisa_statement_sanitized.tsv');
const HOLDER = 'Helena Prado Exemplo';
const TOTALS = { new: 13, duplicate: 0, ignored: 5, unrecognized: 0, invalid: 0 };

beforeAll(async () => {
  const { apiUrl, dbUrl, publishableKey } = getLocalStack();
  app = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl, supabasePublishableKey: publishableKey });
  await app.ready();
});

const userIds: string[] = [];

afterAll(async () => {
  await app.close();
  await removeImportObjects(userIds);
  await cleanupTestUsers();
  await closeAdminSql();
});

interface Owner {
  user: TestUser;
  sofisaId: string;
  nubankId: string;
}

async function createAccount(user: TestUser, bank: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { bank, nickname: `${bank} ${randomUUID()}`, holderNames: [HOLDER] },
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

async function owner(): Promise<Owner> {
  const user = await createTestUser();
  userIds.push(user.id);
  return { user, sofisaId: await createAccount(user, 'SofisaDireto'), nubankId: await createAccount(user, 'Nubank') };
}

function send(url: string, o: Owner, accountId: string, content: string, filename: string, extra: Record<string, string> = {}) {
  const body = multipart({ accountId, ...extra }, [{ filename, content }]);
  return app.inject({
    method: 'POST',
    url,
    headers: { authorization: `Bearer ${o.user.token}`, ...body.headers },
    payload: body.payload,
  });
}

const preview = (o: Owner, content: string, filename: string, accountId = o.sofisaId) =>
  send('/imports/preview', o, accountId, content, filename);

const confirm = (o: Owner, content: string, filename: string, indexes: number[], accountId = o.sofisaId) =>
  send('/imports/confirm', o, accountId, content, filename, {
    idempotencyKey: randomUUID(),
    selections: JSON.stringify(indexes.map((index) => ({ index, neutral: false }))),
  });

interface Row {
  index: number;
  localDate: string;
  type: string;
  amount: string;
  name: string;
  paymentMethod: string;
  categoryName: string;
  status: string;
  neutral: boolean;
  counterpartyDocument: string | null;
  counterpartyBank: string | null;
}
interface Preview {
  rows: Row[];
  totals: Record<string, number>;
}

const IMPORTABLE = [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 14, 15, 16];

describe('Sofisa Direto import', () => {
  it.each([
    ['CSV', CSV, 'sofisa.csv'],
    ['TSV', TSV, 'sofisa.tsv'],
  ])('previews the %s: totals, methods, categories and holder Pix as neutral', async (_label, content, filename) => {
    const o = await owner();
    const res = await preview(o, content, filename);
    expect(res.statusCode).toBe(200);
    const { rows, totals } = res.json<Preview>();
    expect(rows).toHaveLength(18);
    expect(totals).toEqual(TOTALS);
    expect(rows.filter((r) => r.status === 'ignored').map((r) => r.index)).toEqual([2, 6, 10, 13, 17]);
    expect(rows[0]).toMatchObject({
      localDate: '2025-11-03', type: 'Expense', amount: '0.07', name: 'IOF Limite Especial',
      paymentMethod: 'Other', categoryName: 'Sem categoria', status: 'new', neutral: false,
      counterpartyDocument: null, counterpartyBank: null,
    });
    expect(rows[3]).toMatchObject({
      type: 'Income', amount: '1215.30', name: HOLDER, paymentMethod: 'PIX', categoryName: 'Sem categoria', neutral: true,
    });
    expect(rows[4]).toMatchObject({ type: 'Income', amount: '12345.67', name: 'CASA EXEMPLO COMERCIO', paymentMethod: 'PIX', neutral: false });
    expect(rows[14]).toMatchObject({ name: 'HELENA PRADO EXEMPLO', neutral: true });
    expect(rows[5]).toMatchObject({ type: 'Expense', amount: '2088.40', paymentMethod: 'BankTransfer', categoryName: 'Sem categoria' });
    expect(rows[7]).toMatchObject({ amount: '15000.00', paymentMethod: 'BankTransfer', categoryName: 'Investimentos' });
    expect(rows[11]).toMatchObject({ type: 'Income', amount: '8.25', paymentMethod: 'Other', categoryName: 'Sem categoria' });
    expect(rows.filter((r) => r.neutral).map((r) => r.index)).toEqual([3, 14]);
  });

  it('gives the CSV and the TSV the same preview', async () => {
    const o = await owner();
    const csv = (await preview(o, CSV, 'a.csv')).json<Preview>();
    const tsv = (await preview(o, TSV, 'a.tsv')).json<Preview>();
    expect(tsv.rows.map(({ index, localDate, amount, name, status }) => ({ index, localDate, amount, name, status }))).toEqual(
      csv.rows.map(({ index, localDate, amount, name, status }) => ({ index, localDate, amount, name, status })),
    );
  });

  it('imports the 13 transactions (identical rows included), never the daily balance, then flags a reimport as duplicate', async () => {
    const o = await owner();
    const res = await confirm(o, CSV, 'sofisa.csv', IMPORTABLE);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ imported: 13, skipped: 5 });

    const sql = getAdminSql();
    const stored = await sql<{ name: string; description: string; payment_method: string; identifier: string | null }[]>`
      select name, description, payment_method, identifier from public.transactions where user_id = ${o.user.id}`;
    expect(stored).toHaveLength(13);
    expect(stored.filter((r) => r.name === 'IOF Limite Especial')).toHaveLength(3);
    expect(stored.every((r) => r.identifier === null)).toBe(true);
    expect(stored.filter((r) => /saldo/i.test(r.name) || /saldo/i.test(r.description))).toEqual([]);
    expect((await importState(o.user.id)).transactions).toBe(13);

    for (const [content, filename] of [[CSV, 'again.csv'], [TSV, 'again.tsv']] as const) {
      const again = (await preview(o, content, filename)).json<Preview>();
      expect(again.totals, filename).toEqual({ new: 0, duplicate: 13, ignored: 5, unrecognized: 0, invalid: 0 });
      expect(again.rows.filter((r) => r.status === 'duplicate').map((r) => r.index), filename).toEqual(IMPORTABLE);
    }
  });

  it('rejects selecting a daily balance row and writes nothing', async () => {
    const o = await owner();
    const res = await confirm(o, TSV, 'sofisa.tsv', [2]);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: { code: 'invalid_selection', field: 'selections' } });
    expect(await importState(o.user.id)).toMatchObject({ transactions: 0, batches: 0 });
  });

  it('rejects a Sofisa file on a Nubank account and a Nubank file on a Sofisa account (bank_mismatch)', async () => {
    const o = await owner();
    for (const [content, filename] of [[CSV, 'sofisa.csv'], [TSV, 'sofisa.tsv']] as const) {
      const res = await preview(o, content, filename, o.nubankId);
      expect(res.statusCode, filename).toBe(422);
      expect(res.json(), filename).toMatchObject({ error: { code: 'bank_mismatch' } });
    }
    for (const name of ['nubank_account.csv', 'nubank_invoice.csv']) {
      const res = await preview(o, fixture(name), name, o.sofisaId);
      expect(res.statusCode, name).toBe(422);
      expect(res.json(), name).toMatchObject({ error: { code: 'bank_mismatch' } });
    }
  });

  it('keeps the Nubank statement working on a Nubank account of the same user', async () => {
    const o = await owner();
    const res = await preview(o, fixture('nubank_account.csv'), 'nubank.csv', o.nubankId);
    expect(res.statusCode).toBe(200);
    expect(res.json<Preview>().totals).toEqual({ new: 14, duplicate: 0, ignored: 0, unrecognized: 0, invalid: 0 });
  });
});

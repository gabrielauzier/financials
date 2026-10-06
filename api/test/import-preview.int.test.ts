import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { fixture } from './helpers/fixtures.js';
import { importState } from './helpers/imports.js';
import { multipart, type FilePart } from './helpers/multipart.js';
import { getLocalStack } from './helpers/stack.js';
import { removeImportObjects } from './helpers/storage.js';

let app: FastifyInstance;
let user: TestUser;
let nubankId: string;

const ACCOUNT_CSV = fixture('nubank_account.csv');
const INVOICE_CSV = fixture('nubank_invoice.csv');
const HOLDER = 'Gabriel Vasconcelos Auzier';

beforeAll(async () => {
  const { apiUrl, dbUrl } = getLocalStack();
  app = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl });
  await app.ready();
  user = await createTestUser();
  nubankId = await createAccount(user, { bank: 'Nubank', holderNames: [HOLDER] });
});

afterAll(async () => {
  await app.close();
  await removeImportObjects([user.id]);
  await cleanupTestUsers();
  await closeAdminSql();
});

async function createAccount(as: TestUser, body: { bank: string; holderNames?: string[] }): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: { authorization: `Bearer ${as.token}` },
    payload: { bank: body.bank, nickname: `Conta ${randomUUID()}`, holderNames: body.holderNames ?? ['Maria'] },
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

function preview(fields: Record<string, string>, files: FilePart[], as: TestUser = user) {
  const body = multipart(fields, files);
  return app.inject({
    method: 'POST',
    url: '/imports/preview',
    headers: { authorization: `Bearer ${as.token}`, ...body.headers },
    payload: body.payload,
  });
}

const csv = (content: Buffer | string, filename = 'extrato.csv'): FilePart => ({ filename, content });

interface PreviewRow {
  index: number;
  localDate: string;
  type: string;
  amount: string;
  name: string;
  paymentMethod: string;
  categoryName: string;
  status: string;
  neutral: boolean;
  reason?: string;
  counterpartyDocument: string | null;
  counterpartyBank: string | null;
}
interface Preview {
  rows: PreviewRow[];
  totals: Record<string, number>;
}

describe('POST /imports/preview', () => {
  it('returns the 14 account rows with fields, categories, neutral flags and totals', async () => {
    const res = await preview({ accountId: nubankId }, [csv(ACCOUNT_CSV)]);
    expect(res.statusCode).toBe(200);
    const body = res.json<Preview>();
    expect(body.rows).toHaveLength(14);
    expect(body.rows.map((r) => r.index)).toEqual([...Array(14).keys()]);
    expect(body.totals).toEqual({ new: 14, duplicate: 0, ignored: 0, unrecognized: 0, invalid: 0 });
    expect(body.rows.filter((r) => r.neutral).map((r) => r.index)).toEqual([3, 4, 5, 8, 12, 13]);

    expect(body.rows[2]).toEqual({
      index: 2,
      localDate: '2026-07-02',
      type: 'Income',
      amount: '8608.00',
      name: 'MERCADO AUTO SOLUCOES PUBLICIDADE E TECNOLOGIA LTDA',
      paymentMethod: 'PIX',
      categoryName: 'Sem categoria',
      status: 'new',
      neutral: false,
      counterpartyDocument: '41.460.383/0001-68',
      counterpartyBank: 'BCO SANTANDER (BRASIL) S.A. (0033)',
    });
    expect(body.rows[0]).toMatchObject({
      name: 'Débito em conta', type: 'Expense', amount: '82.32', paymentMethod: 'DebitCard',
      categoryName: 'Sem categoria', counterpartyDocument: null, counterpartyBank: null,
    });
    expect(body.rows[1]).toMatchObject({
      name: 'Dinheiro guardado com resgate planejado', paymentMethod: 'BankTransfer', categoryName: 'Investimentos',
    });
  });

  it('flags a row whose identifier already exists on the account as duplicate', async () => {
    const other = await createTestUser();
    const accountId = await createAccount(other, { bank: 'Nubank', holderNames: [HOLDER] });
    const [category] = await getAdminSql()`
      select id from public.categories where user_id = ${other.id} and key = 'Uncategorized'`;
    await getAdminSql()`
      insert into public.transactions
        (user_id, account_id, category_id, name, type, occurred_at, amount, payment_method, identifier)
      values (${other.id}, ${accountId}, ${(category as { id: string }).id}, 'Débito em conta', 'Expense',
              '2026-07-02T03:00:00Z', '82.32', 'DebitCard', '6a442c8d-0f0c-471a-8aba-ca4523ca8ebb')`;

    const res = await preview({ accountId }, [csv(ACCOUNT_CSV)], other);
    expect(res.statusCode).toBe(200);
    const body = res.json<Preview>();
    expect(body.rows.filter((r) => r.status === 'duplicate').map((r) => r.index)).toEqual([0]);
    expect(body.totals).toEqual({ new: 13, duplicate: 1, ignored: 0, unrecognized: 0, invalid: 0 });
  });

  it('carries NuPay, Boleto and Other in the preview, the unknown line flagged as unrecognized (IMPFIX-02)', async () => {
    const res = await preview({ accountId: nubankId }, [
      csv(
        [
          'Data,Valor,Identificador,Descrição',
          '02/09/2026,-10.00,m-1,Compra no débito via NuPay - Entrega Rapida',
          '03/09/2026,-20.00,m-2,Pagamento de boleto efetuado - ESCOLA SUL',
          '04/09/2026,-30.00,m-3,Algo que a tabela não conhece',
          '',
        ].join('\n'),
      ),
    ]);
    expect(res.statusCode).toBe(200);
    const body = res.json<Preview>();
    expect(body.rows.map((r) => [r.paymentMethod, r.status, r.name])).toEqual([
      ['NuPay', 'new', 'Entrega Rapida'],
      ['Boleto', 'new', 'ESCOLA SUL'],
      ['Other', 'unrecognized', 'Algo que a tabela não conhece'],
    ]);
    expect(body.totals).toEqual({ new: 2, duplicate: 0, ignored: 0, unrecognized: 1, invalid: 0 });
  });

  describe('deduplication with the extracted names (IMPFIX-08)', () => {
    async function seed(name: string, over: { identifier?: string | null; amount?: string } = {}) {
      const other = await createTestUser();
      const accountId = await createAccount(other, { bank: 'Nubank', holderNames: [HOLDER] });
      const [category] = await getAdminSql()`
        select id from public.categories where user_id = ${other.id} and key = 'Uncategorized'`;
      await getAdminSql()`
        insert into public.transactions
          (user_id, account_id, category_id, name, type, occurred_at, amount, payment_method, identifier)
        values (${other.id}, ${accountId}, ${(category as { id: string }).id}, ${name}, 'Expense',
                '2026-09-02T03:00:00Z', ${over.amount ?? '12.34'}, 'DebitCard', ${over.identifier ?? null})`;
      return { other, accountId };
    }
    const statement = (identifier: string, description: string) =>
      csv(`Data,Valor,Identificador,Descrição\n02/09/2026,-12.34,${identifier},${description}\n`);

    it('keeps a row with an existing identifier duplicate even when the stored name differs', async () => {
      const { other, accountId } = await seed('Texto antigo inteiro', { identifier: 'ident-1' });
      const res = await preview({ accountId }, [statement('ident-1', 'Compra no débito - Padaria Estrela Azul')], other);
      expect(res.json<Preview>().rows.map((r) => [r.name, r.status])).toEqual([['Padaria Estrela Azul', 'duplicate']]);
    });

    it('marks a row without identifier duplicate when the extracted name, local day, amount and type match', async () => {
      const { other, accountId } = await seed('Padaria Estrela Azul');
      const res = await preview({ accountId }, [statement('', 'Compra no débito - Padaria Estrela Azul')], other);
      expect(res.json<Preview>().rows.map((r) => r.status)).toEqual(['duplicate']);
    });

    it('keeps a row without identifier new when only the extracted name differs', async () => {
      const { other, accountId } = await seed('Padaria Estrela Azul');
      const res = await preview({ accountId }, [statement('', 'Compra no débito - Padaria Estrela Verde')], other);
      expect(res.json<Preview>().rows.map((r) => r.status)).toEqual(['new']);
    });
  });

  it('returns the invoice as 18 new purchases and 1 ignored row', async () => {
    const res = await preview({ accountId: nubankId }, [csv(INVOICE_CSV, 'fatura.csv')]);
    expect(res.statusCode).toBe(200);
    const body = res.json<Preview>();
    expect(body.rows).toHaveLength(19);
    expect(body.totals).toEqual({ new: 18, duplicate: 0, ignored: 1, unrecognized: 0, invalid: 0 });
    expect(body.rows.filter((r) => r.status === 'ignored').map((r) => r.name)).toEqual(['Pagamento recebido']);
    expect(body.rows.find((r) => r.name === 'Prado Som Car - Parcela 3/6')).toMatchObject({
      type: 'Expense', amount: '343.72', paymentMethod: 'CreditCard', categoryName: 'Sem categoria', status: 'new',
    });
  });

  it('shows invalid rows with their reason', async () => {
    const res = await preview({ accountId: nubankId }, [
      csv('Data,Valor,Identificador,Descrição\n31/02/2026,-1.00,a,Débito em conta\n02/07/2026,0.00,b,Débito em conta\n'),
    ]);
    expect(res.statusCode).toBe(200);
    const body = res.json<Preview>();
    expect(body.rows.map((r) => r.status)).toEqual(['invalid', 'invalid']);
    expect(body.rows.every((r) => typeof r.reason === 'string' && r.reason !== '')).toBe(true);
    expect(body.totals).toEqual({ new: 0, duplicate: 0, ignored: 0, unrecognized: 0, invalid: 2 });
  });

  it('rejects a file over 5 MB with 413 file_too_large', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1, 'a');
    const res = await preview({ accountId: nubankId }, [csv(big)]);
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ error: { code: 'file_too_large', message: expect.any(String), field: 'file' } });
  });

  it('accepts a file of exactly 5 MB (the limit is inclusive): it reaches the format check', async () => {
    const content = Buffer.alloc(5 * 1024 * 1024, 'a');
    content.write('unknown\n');
    const res = await preview({ accountId: nubankId }, [csv(content)]);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: { code: 'unsupported_format' } });
  });

  it('rejects an unknown header with 422 unsupported_format', async () => {
    const res = await preview({ accountId: nubankId }, [csv('Date,Amount,Description\n2026-10-01,1.00,x\n')]);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: { code: 'unsupported_format' } });
  });

  it('rejects a Nubank file sent to an account of another bank with 422 bank_mismatch', async () => {
    const xpId = await createAccount(user, { bank: 'XP' });
    const res = await preview({ accountId: xpId }, [csv(INVOICE_CSV)]);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: { code: 'bank_mismatch' } });
  });

  it.each([
    ['empty', ''],
    ['header-only', 'date,title,amount\n'],
  ])('rejects an %s file with 422 empty_file', async (_label, content) => {
    const res = await preview({ accountId: nubankId }, [csv(content)]);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: { code: 'empty_file' } });
  });

  it('rejects an inactive, missing or malformed account with 422 invalid_account', async () => {
    const inactiveId = await createAccount(user, { bank: 'Nubank' });
    await getAdminSql()`update public.accounts set active = false where id = ${inactiveId}`;
    for (const accountId of [inactiveId, randomUUID(), 'not-a-uuid', '']) {
      const res = await preview({ accountId }, [csv(ACCOUNT_CSV)]);
      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({ error: { code: 'invalid_account', message: expect.any(String), field: 'accountId' } });
    }
  });

  it('answers 400 validation_error for a missing file or accountId, two files, a non-multipart or malformed body', async () => {
    const noFile = await preview({ accountId: nubankId }, []);
    expect(noFile.statusCode).toBe(400);
    expect(noFile.json()).toMatchObject({ error: { code: 'validation_error', field: 'file' } });

    const noAccount = await preview({}, [csv(ACCOUNT_CSV)]);
    expect(noAccount.statusCode).toBe(400);
    expect(noAccount.json()).toMatchObject({ error: { code: 'validation_error', field: 'accountId' } });

    const twoFiles = await preview({ accountId: nubankId }, [csv(ACCOUNT_CSV), csv(INVOICE_CSV)]);
    expect(twoFiles.statusCode).toBe(400);
    expect(twoFiles.json()).toMatchObject({ error: { code: 'validation_error', field: 'file' } });

    const json = await app.inject({
      method: 'POST',
      url: '/imports/preview',
      headers: { authorization: `Bearer ${user.token}` },
      payload: { accountId: nubankId },
    });
    expect(json.statusCode).toBe(400);
    expect(json.json()).toMatchObject({ error: { code: 'validation_error' } });

    for (const [contentType, payload] of [
      ['multipart/form-data', 'no boundary'],
      ['multipart/form-data; boundary=x', '--x\r\nContent-Disposition: form-data; name="file"; filename="a.csv"\r\n\r\nabc'],
    ]) {
      const malformed = await app.inject({
        method: 'POST',
        url: '/imports/preview',
        headers: { authorization: `Bearer ${user.token}`, 'content-type': contentType as string },
        payload,
      });
      expect(malformed.statusCode).toBe(400);
      expect(malformed.json()).toMatchObject({ error: { code: 'validation_error' } });
    }
  });

  it('writes nothing: no transaction, batch, attachment or stored file', async () => {
    const other = await createTestUser();
    const accountId = await createAccount(other, { bank: 'Nubank', holderNames: [HOLDER] });
    const before = await importState(other.id);
    expect(before).toEqual({ transactions: 0, batches: 0, attachments: 0, objects: 0 });

    expect((await preview({ accountId }, [csv(ACCOUNT_CSV)], other)).statusCode).toBe(200);
    expect((await preview({ accountId }, [csv(INVOICE_CSV)], other)).statusCode).toBe(200);
    expect(await importState(other.id)).toEqual(before);
  });
});

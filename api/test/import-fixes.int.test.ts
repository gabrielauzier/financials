import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { fixture } from './helpers/fixtures.js';
import { multipart } from './helpers/multipart.js';
import { getLocalStack } from './helpers/stack.js';
import { removeImportObjects } from './helpers/storage.js';

/**
 * IMPFIX-01: the sanitized September statement (96 rows, one of every description format) must be
 * mapped by method, category, type, name and neutral flag, and its original text saved as
 * `description`. Expectations come from the spec's format table, written here independently of the
 * parser: the row kind is read from the literal prefix of each CSV line.
 */
let app: FastifyInstance;
let user: TestUser;
let personAccountId: string;

const CSV = fixture('nubank_statement_sanitized.csv');

beforeAll(async () => {
  const { apiUrl, dbUrl, publishableKey } = getLocalStack();
  app = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl, supabasePublishableKey: publishableKey });
  await app.ready();
  user = await createTestUser();
  personAccountId = await createAccount('Maria Souza Lima');
  await createAccount('Maria Souza Lima LTDA');
});

afterAll(async () => {
  await app.close();
  await removeImportObjects([user.id]);
  await cleanupTestUsers();
  await closeAdminSql();
});

async function createAccount(holder: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { bank: 'Nubank', nickname: `Conta ${randomUUID()}`, holderNames: [holder] },
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

interface Expected {
  index: number;
  identifier: string;
  description: string;
  type: 'Income' | 'Expense';
  amount: string;
  paymentMethod: string;
  categoryName: string;
  name: string;
  neutral: boolean;
  document: string | null;
  bank: string | null;
}

const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();
const TRANSFER = /^[^-]+? - (.+?) - ([\d./•*-]+) - (.+?) Agência:/;

function expectedFor(line: string, index: number): Expected {
  const [, value, identifier, ...rest] = line.split(',') as [string, string, string, ...string[]];
  const description = rest.join(',');
  const base = {
    index,
    identifier,
    description: collapse(description),
    type: value.startsWith('-') ? ('Expense' as const) : ('Income' as const),
    amount: value.replace('-', ''),
    categoryName: 'Sem categoria',
    document: null as string | null,
    bank: null as string | null,
  };
  const after = (prefix: string) => collapse(description.slice(prefix.length));
  const transfer = (paymentMethod: string): Expected => {
    const match = TRANSFER.exec(description) as RegExpExecArray;
    const name = collapse(match[1] as string);
    const neutral = ['maria souza lima', 'maria souza lima ltda'].includes(name.toLowerCase());
    return { ...base, paymentMethod, name, neutral, document: match[2] as string, bank: match[3] as string };
  };
  const plain = (paymentMethod: string, name: string, categoryName = 'Sem categoria'): Expected => ({
    ...base,
    paymentMethod,
    name,
    categoryName,
    neutral: false,
  });
  const reversal = 'Estorno (de compras)';
  if (description.startsWith('Compra no débito via NuPay - ')) {
    return plain('NuPay', after('Compra no débito via NuPay - '));
  }
  if (description.startsWith('Compra no débito - ')) return plain('DebitCard', after('Compra no débito - '));
  if (description.startsWith('Estorno - Compra no débito - ')) {
    return plain('DebitCard', after('Estorno - Compra no débito - '), reversal);
  }
  if (description.startsWith('Estorno - Ajuste de compra no débito - ')) {
    return plain('DebitCard', after('Estorno - Ajuste de compra no débito - '), reversal);
  }
  if (description.startsWith('Pagamento de boleto efetuado - ')) {
    return plain('Boleto', after('Pagamento de boleto efetuado - '));
  }
  if (/^(Transferência (enviada|recebida) pelo Pix|Reembolso recebido pelo Pix) - /.test(description)) {
    return transfer('PIX');
  }
  if (description.startsWith('Transferência Recebida - ')) return transfer('BankTransfer');
  if (description === 'Pagamento de fatura') return plain('BankTransfer', 'Pagamento de fatura');
  throw new Error(`fixture line without a known format: ${line}`);
}

const LINES = CSV.trim().split('\n').slice(1);
const EXPECTED = LINES.map(expectedFor);

interface PreviewRow {
  index: number;
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
  rows: PreviewRow[];
  totals: Record<string, number>;
}

async function preview(): Promise<Preview> {
  const body = multipart({ accountId: personAccountId }, [{ filename: 'extrato.csv', content: CSV }]);
  const res = await app.inject({
    method: 'POST',
    url: '/imports/preview',
    headers: { authorization: `Bearer ${user.token}`, ...body.headers },
    payload: body.payload,
  });
  expect(res.statusCode).toBe(200);
  return res.json<Preview>();
}

const count = <T>(items: T[], key: (item: T) => string) =>
  items.reduce<Record<string, number>>((acc, item) => ({ ...acc, [key(item)]: (acc[key(item)] ?? 0) + 1 }), {});

describe('import of the sanitized September statement', () => {
  it('previews 96 recognized rows with the method, category, type and name of every format', async () => {
    const body = await preview();
    expect(body.rows).toHaveLength(96);
    expect.soft(body.totals).toEqual({ new: 96, duplicate: 0, ignored: 0, unrecognized: 0, invalid: 0 });
    expect.soft(count(body.rows, (r) => r.paymentMethod)).toEqual({
      DebitCard: 61,
      NuPay: 6,
      PIX: 19,
      BankTransfer: 4,
      Boleto: 6,
    });
    expect.soft(count(body.rows, (r) => r.categoryName)).toEqual({ 'Estorno (de compras)': 8, 'Sem categoria': 88 });
    expect.soft(count(body.rows, (r) => r.type)).toEqual({ Income: 13, Expense: 83 });
    expect(body.rows.map((r) => r.status)).toEqual(Array(96).fill('new'));

    for (const want of EXPECTED) {
      expect(body.rows[want.index], `row ${want.index}: ${want.description}`).toMatchObject({
        index: want.index,
        type: want.type,
        amount: want.amount,
        name: want.name,
        paymentMethod: want.paymentMethod,
        categoryName: want.categoryName,
        status: 'new',
        counterpartyDocument: want.document,
        counterpartyBank: want.bank,
      });
    }
    // One literal example per format, to anchor the table above.
    const byName = (name: string) => body.rows.find((r) => r.name === name) as PreviewRow;
    expect(byName('RIDEX *VIAGEM CENTRAL')).toMatchObject({ paymentMethod: 'DebitCard' });
    expect(byName('Entrega Rapida Foods')).toMatchObject({ paymentMethod: 'NuPay' });
    expect(byName('ESCOLA HORIZONTE DE IDIOMAS')).toMatchObject({ paymentMethod: 'Boleto' });
    expect(byName('Vitor Hugo Siqueira')).toMatchObject({
      paymentMethod: 'PIX',
      type: 'Income',
      counterpartyDocument: '•••.120.457-••',
      counterpartyBank: 'BCO ALFA (0123)',
    });
    expect(byName('MARIA SOUZA LIMA LTDA')).toMatchObject({
      paymentMethod: 'BankTransfer',
      counterpartyDocument: '11.444.777/0001-62',
      counterpartyBank: 'NU PAGAMENTOS - IP (0260)',
    });
    expect(byName('Pagamento de fatura')).toMatchObject({ paymentMethod: 'BankTransfer' });
  });

  it('marks as neutral exactly the Pix to the holder and the 3 transfers from the LTDA holder', async () => {
    const body = await preview();
    const neutral = body.rows.filter((r) => r.neutral);
    expect(neutral.map((r) => r.name).sort()).toEqual([
      'MARIA SOUZA LIMA LTDA',
      'MARIA SOUZA LIMA LTDA',
      'MARIA SOUZA LIMA LTDA',
      'Maria Souza Lima',
    ]);
    expect(neutral.map((r) => r.index)).toEqual(EXPECTED.filter((e) => e.neutral).map((e) => e.index));
    expect(body.rows.filter((r) => !r.neutral)).toHaveLength(92);
  });

  it('confirms with the preview neutral marks and stores method, name, neutral and the original text', async () => {
    const body = await preview();
    const selections = body.rows.map((r) => ({ index: r.index, neutral: r.neutral }));
    const form = multipart(
      { accountId: personAccountId, idempotencyKey: randomUUID(), selections: JSON.stringify(selections) },
      [{ filename: 'extrato.csv', content: CSV }],
    );
    const res = await app.inject({
      method: 'POST',
      url: '/imports/confirm',
      headers: { authorization: `Bearer ${user.token}`, ...form.headers },
      payload: form.payload,
    });
    expect(res.statusCode).toBe(201);

    const stored = await getAdminSql()<
      { identifier: string; name: string; payment_method: string; neutral: boolean; description: string | null }[]
    >`
      select identifier, name, payment_method, neutral, description
      from public.transactions where user_id = ${user.id}`;
    expect(stored).toHaveLength(96);
    const byIdentifier = new Map(stored.map((s) => [s.identifier, s]));
    for (const want of EXPECTED) {
      expect(byIdentifier.get(want.identifier), `row ${want.index}: ${want.description}`).toMatchObject({
        name: want.name,
        payment_method: want.paymentMethod,
        neutral: want.neutral,
        description: want.description,
      });
    }
    expect(stored.filter((s) => s.neutral)).toHaveLength(4);
  });

  it('returns the saved original text and the extracted name from GET /transactions', async () => {
    const items: { name: string; description: string | null; paymentMethod: string }[] = [];
    for (const page of [1, 2]) {
      const res = await app.inject({
        method: 'GET',
        url: `/transactions?page=${page}`,
        headers: { authorization: `Bearer ${user.token}` },
      });
      expect(res.statusCode).toBe(200);
      items.push(...res.json<{ items: typeof items }>().items);
    }
    expect(items).toHaveLength(96);
    const compra = EXPECTED.find((e) => e.name === 'Padaria Estrela Azul') as Expected;
    expect(items.find((t) => t.description === compra.description)).toMatchObject({
      name: 'Padaria Estrela Azul',
      paymentMethod: 'DebitCard',
    });
    const transfer = EXPECTED.find((e) => e.name === 'Vitor Hugo Siqueira') as Expected;
    expect(transfer.description).toContain('Vitor Hugo Siqueira - ');
    expect(items.find((t) => t.description === transfer.description)).toMatchObject({
      name: 'Vitor Hugo Siqueira',
      paymentMethod: 'PIX',
    });
  });
});

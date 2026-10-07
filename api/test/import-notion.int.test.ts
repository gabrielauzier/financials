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

const NOTION = fixture('notion_sanitized.csv');
const HEADER = 'Name,Type,Date,Amount,Category,Payment Method,Notes,Receipt,Created time,ID,Identifier';
const BANKS = ['Nubank', 'SofisaDireto', 'Neon', 'XP', 'Other'];
const TOTALS = { new: 19, duplicate: 1, ignored: 2, unrecognized: 3, invalid: 2 };
/** Every row that can be selected, except index 23 (a repeated Identifier). */
const IMPORTABLE = [0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 24, 25, 26];
const IDENTIFIER_1 = '00000000-0000-4000-8000-000000000001';
const IDENTIFIER_2 = '00000000-0000-4000-8000-000000000002';

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
  accounts: Record<string, string>;
}

const auth = (o: Owner) => ({ authorization: `Bearer ${o.user.token}` });

async function createAccount(user: TestUser, bank: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { bank, nickname: `${bank} ${randomUUID()}`, holderNames: ['Titular Fictício Exemplo'] },
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

async function owner(banks: string[] = ['Nubank']): Promise<Owner> {
  const user = await createTestUser();
  userIds.push(user.id);
  const accounts: Record<string, string> = {};
  for (const bank of banks) accounts[bank] = await createAccount(user, bank);
  return { user, accounts };
}

interface Row {
  index: number;
  type: string;
  amount: string;
  name: string;
  paymentMethod: string;
  categoryId: string;
  categoryName: string;
  status: string;
  neutral: boolean;
  reason?: string;
}
interface Preview {
  rows: Row[];
  totals: Record<string, number>;
}

function send(url: string, o: Owner, accountId: string, content: string, extra: Record<string, string> = {}) {
  const body = multipart({ accountId, ...extra }, [{ filename: 'notion.csv', content }]);
  return app.inject({ method: 'POST', url, headers: { ...auth(o), ...body.headers }, payload: body.payload });
}

const preview = async (o: Owner, accountId: string, content = NOTION): Promise<Preview> => {
  const res = await send('/imports/preview', o, accountId, content);
  expect(res.statusCode).toBe(200);
  return res.json<Preview>();
};

interface Pick {
  index: number;
  neutral?: boolean;
  categoryId?: string;
}

/** Confirms the given rows; `neutral` defaults to what the preview proposed. */
async function confirm(o: Owner, accountId: string, picks: Pick[], content = NOTION, proposed?: Preview) {
  const selections = picks.map((p) => ({
    index: p.index,
    neutral: p.neutral ?? proposed?.rows[p.index]?.neutral ?? false,
    ...(p.categoryId === undefined ? {} : { categoryId: p.categoryId }),
  }));
  return send('/imports/confirm', o, accountId, content, { idempotencyKey: randomUUID(), selections: JSON.stringify(selections) });
}

const all = (indexes: number[]): Pick[] => indexes.map((index) => ({ index }));

interface Stored {
  name: string;
  type: string;
  amount: string;
  payment_method: string;
  identifier: string | null;
  neutral: boolean;
  notes: string | null;
  receipt: string | null;
  description: string | null;
  category: string;
}

async function stored(o: Owner): Promise<Stored[]> {
  return getAdminSql()<Stored[]>`
    select t.name, t.type, t.amount::text as amount, t.payment_method, t.identifier, t.neutral, t.notes, t.receipt,
           t.description, c.name as category
    from public.transactions t join public.categories c on c.id = t.category_id
    where t.user_id = ${o.user.id}`;
}

describe('Notion import preview', () => {
  it.each(BANKS)('accepts the model on a %s account with the same classification', async (bank) => {
    const o = await owner([bank]);
    const { rows, totals } = await preview(o, o.accounts[bank]!);
    expect(rows).toHaveLength(27);
    expect(totals).toEqual(TOTALS);
    expect(rows.filter((r) => r.status === 'ignored').map((r) => r.index)).toEqual([7, 8]);
    expect(rows.filter((r) => r.status === 'invalid').map((r) => r.index)).toEqual([12, 22]);
    expect(rows.filter((r) => r.status === 'unrecognized').map((r) => r.index)).toEqual([11, 16, 24]);
    expect(rows.filter((r) => r.status === 'duplicate').map((r) => r.index)).toEqual([23]);
  });

  it('resolves each category by key, pt-BR name, alias and default, with reasons for the rest', async () => {
    const o = await owner();
    const { rows } = await preview(o, o.accounts.Nubank!);
    const category = (i: number) => rows[i]!.categoryName;
    expect([0, 17, 18, 9, 11].map(category)).toEqual(Array(5).fill('Alimentação')); // key, accent-less name, any case
    expect(category(1)).toBe('Contas');
    expect(category(2)).toBe('Salários');
    expect(category(3)).toBe('Transporte');
    expect(category(13)).toBe('Emergência'); // Needed
    expect(category(14)).toBe('Pets'); // Leo 😺
    expect(category(15)).toBe('Sem categoria'); // empty
    expect(category(16)).toBe('Sem categoria'); // unknown label
    expect(category(25)).toBe('Saúde');
    expect(category(26)).toBe('Desconhecida'); // the system key Unknown
    expect(rows[16]).toMatchObject({ status: 'unrecognized', reason: 'Categoria "Xyzzy" não encontrada' });
    expect(rows[11]).toMatchObject({ status: 'unrecognized', reason: 'Tipo ausente', categoryName: 'Alimentação' });
    expect(rows[24]).toMatchObject({
      status: 'unrecognized', reason: 'Forma de pagamento "Cheque" não reconhecida', paymentMethod: 'Other', categoryName: 'Ajuda (a terceiros)',
    });
    expect(rows[14]!.categoryId).toBe(rows.find((r) => r.categoryName === 'Pets')!.categoryId);
  });

  it('proposes the neutral rows and types: Neutral Reversal is an Income, Neutral otherwise an Expense', async () => {
    const o = await owner();
    const { rows } = await preview(o, o.accounts.Nubank!);
    expect(rows.filter((r) => r.neutral).map((r) => r.index)).toEqual([5, 6]);
    expect(rows[5]).toMatchObject({ type: 'Income', amount: '30.43', categoryName: 'Estorno (de compras)' });
    expect(rows[6]).toMatchObject({ type: 'Expense', amount: '100.29', categoryName: 'Investimentos' });
  });

  it('reads amounts, types, methods and names', async () => {
    const o = await owner();
    const { rows } = await preview(o, o.accounts.Nubank!);
    expect(rows[0]).toMatchObject({ type: 'Expense', amount: '25.37', paymentMethod: 'DebitCard', name: 'Empório Zeta' });
    expect(rows[1]).toMatchObject({ amount: '9999.99', paymentMethod: 'CreditCard' });
    expect(rows[2]).toMatchObject({ type: 'Income', amount: '1234.50', paymentMethod: 'BankTransfer' });
    expect(rows[3]).toMatchObject({ type: 'Expense', amount: '45.61', paymentMethod: 'PIX' });
    expect(rows[4]).toMatchObject({ name: 'Forneria Zeta', paymentMethod: 'Cash' });
    expect(rows[9]).toMatchObject({ type: 'Expense', amount: '18.00' }); // blank type, negative
    expect(rows[10]).toMatchObject({ type: 'Income', amount: '300.17', paymentMethod: 'Other', categoryName: 'Sem categoria' });
    expect(rows[19]!.paymentMethod).toBe('Boleto');
    expect(rows[20]!.paymentMethod).toBe('NuPay');
    expect(rows[12]).toMatchObject({ status: 'invalid', reason: 'Empty amount' });
  });

  it('follows a renamed or deleted seeded category without failing', async () => {
    const o = await owner();
    const categories = (await app.inject({ method: 'GET', url: '/categories', headers: auth(o) })).json<
      { id: string; key: string | null; name: string }[]
    >();
    const id = (key: string) => categories.find((c) => c.key === key)!.id;
    expect((await app.inject({ method: 'PATCH', url: `/categories/${id('Food')}`, headers: auth(o), payload: { name: 'Comida' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/categories/${id('Pets')}`, headers: auth(o) })).statusCode).toBe(204);
    const { rows } = await preview(o, o.accounts.Nubank!);
    expect(rows[0]!.categoryName).toBe('Comida'); // by key
    expect(rows[18]!.categoryName).toBe('Comida'); // FOOD by key
    expect(rows[17]).toMatchObject({ status: 'unrecognized', categoryName: 'Sem categoria' }); // old pt name is gone
    expect(rows[14]).toMatchObject({ status: 'unrecognized', reason: 'Categoria "Leo 😺" não encontrada', categoryName: 'Sem categoria' });
  });

  it('matches a user-created category by its name', async () => {
    const o = await owner();
    const created = await app.inject({ method: 'POST', url: '/categories', headers: auth(o), payload: { name: 'Viagens Éxtra' } });
    expect(created.statusCode).toBe(201);
    const csv = `${HEADER}\nPassagem Fictícia,Expense,01/04/2025,R$80.11,viagens extra,PIX,,,x,91,\n`;
    const { rows } = await preview(o, o.accounts.Nubank!, csv);
    expect(rows[0]).toMatchObject({ status: 'new', categoryName: 'Viagens Éxtra', categoryId: created.json<{ id: string }>().id });
  });

  it('raises unsupported_format for a wrong header and lists Notion in the message', async () => {
    const o = await owner();
    const wrong = NOTION.replace('Payment Method', 'Method');
    const res = await send('/imports/preview', o, o.accounts.Nubank!, wrong);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: { code: 'unsupported_format', message: expect.stringContaining('Notion') as string } });
  });

  it('still rejects a Nubank file on another bank account', async () => {
    const o = await owner(['Nubank', 'XP']);
    const res = await send('/imports/preview', o, o.accounts.XP!, fixture('nubank_account.csv'));
    expect(res.json()).toMatchObject({ error: { code: 'bank_mismatch' } });
  });
});

describe('Notion import confirm', () => {
  it('imports the chosen rows with category, notes and receipt, never the canceled or invalid ones', async () => {
    const o = await owner(['SofisaDireto']);
    const accountId = o.accounts.SofisaDireto!;
    const proposed = await preview(o, accountId);
    const res = await confirm(o, accountId, all(IMPORTABLE), NOTION, proposed);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ imported: 22, skipped: 5 });

    const rows = await stored(o);
    expect(rows).toHaveLength(22);
    const by = (name: string) => rows.find((r) => r.name === name)!;
    expect(by('Empório Zeta')).toMatchObject({
      type: 'Expense', amount: '25.37', payment_method: 'DebitCard', category: 'Alimentação',
      notes: 'Nota fictícia um', receipt: null, identifier: IDENTIFIER_1, description: null, neutral: false,
    });
    expect(by('Livraria Fictícia')).toMatchObject({
      notes: 'Nota fictícia três', receipt: 'https://example.com/recibos/1', category: 'Compras',
    });
    expect(by('Salário Fictício')).toMatchObject({ type: 'Income', amount: '1234.50', identifier: IDENTIFIER_2 });
    expect(by('Devolução Fictícia')).toMatchObject({ type: 'Income', neutral: true, category: 'Estorno (de compras)', notes: 'Nota fictícia dois' });
    expect(by('Aporte Fictício')).toMatchObject({ type: 'Expense', neutral: true, category: 'Investimentos' });
    expect(by('Reserva Fictícia').category).toBe('Emergência');
    expect(by('Ração Fictícia').category).toBe('Pets');
    expect(by('Item Categoria Estranha').category).toBe('Sem categoria');

    // Canceled and invalid rows never reach the database.
    const names = rows.map((r) => r.name);
    for (const absent of ['Pedido Cancelado Fictício', 'Outra Cancelada Fictícia', 'Saldo Fictício', 'Recibo Ruim Fictício']) {
      expect(names, absent).not.toContain(absent);
    }
    expect(rows.filter((r) => r.receipt !== null)).toHaveLength(1);
    expect(rows.filter((r) => r.notes !== null)).toHaveLength(3);
  });

  it('never uses the ID column as the identifier', async () => {
    const o = await owner();
    await confirm(o, o.accounts.Nubank!, all(IMPORTABLE));
    const rows = await stored(o);
    // Two rows share the ID 777 and would collide as identifiers; only the two UUIDs are stored.
    expect(rows.filter((r) => r.identifier !== null).map((r) => r.identifier).sort()).toEqual([IDENTIFIER_1, IDENTIFIER_2]);
    expect(rows.find((r) => r.name === 'Forneria Zeta')!.identifier).toBeNull();
    expect(rows.find((r) => r.name === 'Petisco Sem Tipo')!.identifier).toBeNull();
  });

  it('rejects selecting a canceled, an invalid-amount or an invalid-receipt row, writing nothing', async () => {
    const o = await owner();
    for (const index of [7, 8, 12, 22]) {
      const res = await confirm(o, o.accounts.Nubank!, [{ index }]);
      expect(res.statusCode, String(index)).toBe(422);
      expect(res.json(), String(index)).toMatchObject({ error: { code: 'invalid_selection' } });
    }
    expect(await importState(o.user.id)).toMatchObject({ transactions: 0, batches: 0 });
  });

  it('lets the category chosen in the select win over the resolved one', async () => {
    const o = await owner();
    const proposed = await preview(o, o.accounts.Nubank!);
    const health = proposed.rows[25]!.categoryId;
    const res = await confirm(o, o.accounts.Nubank!, [{ index: 0, categoryId: health }, { index: 16, categoryId: health }, { index: 14 }], NOTION, proposed);
    expect(res.statusCode).toBe(201);
    const rows = await stored(o);
    expect(rows.find((r) => r.name === 'Empório Zeta')!.category).toBe('Saúde');
    expect(rows.find((r) => r.name === 'Item Categoria Estranha')!.category).toBe('Saúde');
    expect(rows.find((r) => r.name === 'Ração Fictícia')!.category).toBe('Pets');
  });

  it('flags a reimport as duplicate: by Identifier and by content', async () => {
    const o = await owner();
    const accountId = o.accounts.Nubank!;
    expect((await confirm(o, accountId, all(IMPORTABLE))).statusCode).toBe(201);
    const again = await preview(o, accountId);
    expect(again.totals).toEqual({ new: 0, duplicate: 23, ignored: 2, unrecognized: 0, invalid: 2 });
    const duplicates = again.rows.filter((r) => r.status === 'duplicate').map((r) => r.index);
    expect(duplicates).toEqual([...IMPORTABLE, 23].sort((a, b) => a - b));
    // Row 23 repeats the Identifier of row 0 (by identifier); row 4 has none (by content).
    expect(duplicates).toContain(23);
    expect(duplicates).toContain(4);
  });

  it('does not treat another account as a duplicate source', async () => {
    const o = await owner(['Nubank', 'XP']);
    expect((await confirm(o, o.accounts.Nubank!, all(IMPORTABLE))).statusCode).toBe(201);
    expect((await preview(o, o.accounts.XP!)).totals).toEqual(TOTALS);
  });
});

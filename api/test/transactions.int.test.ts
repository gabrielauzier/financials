import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { getLocalStack } from './helpers/stack.js';

let app: FastifyInstance;
let user: TestUser;
let accountId: string;

beforeAll(async () => {
  const { apiUrl, dbUrl } = getLocalStack();
  app = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl });
  await app.ready();
  user = await createTestUser();
  accountId = await createAccount(user, 'Principal');
});

afterAll(async () => {
  await app.close();
  await cleanupTestUsers();
  await closeAdminSql();
});

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

function call(as: TestUser, method: Method, url: string, payload?: unknown, headers: Record<string, string> = {}) {
  return app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${as.token}`, ...headers },
    payload: payload as object,
  });
}

async function createAccount(as: TestUser, nickname: string): Promise<string> {
  const res = await call(as, 'POST', '/accounts', { bank: 'Nubank', nickname, holderNames: ['Maria'] });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

async function categoryId(as: TestUser, key: string): Promise<string> {
  const [row] = await getAdminSql()`select id from public.categories where user_id = ${as.id} and key = ${key}`;
  return (row as { id: string }).id;
}

const valid = (over: Record<string, unknown> = {}) => ({
  name: 'Mercado',
  type: 'Expense',
  occurredAt: '2026-10-05T14:30:00-03:00',
  amount: '123.45',
  accountId,
  paymentMethod: 'PIX',
  ...over,
});

describe('POST /transactions', () => {
  it('creates a transaction (201) with a uuid, the Sem categoria default and the full Transaction shape', async () => {
    const res = await call(user, 'POST', '/transactions', valid({ notes: 'feira', receipt: 'https://example.com/r/1' }));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
      accountId,
      accountNickname: 'Principal',
      categoryId: await categoryId(user, 'Uncategorized'),
      categoryName: 'Sem categoria',
      name: 'Mercado',
      type: 'Expense',
      occurredAt: '2026-10-05T17:30:00.000Z',
      amount: '123.45',
      paymentMethod: 'PIX',
      notes: 'feira',
      receipt: 'https://example.com/r/1',
      neutral: false,
      counterpartyDocument: null,
      counterpartyBank: null,
    });
    const rows = await getAdminSql()`
      select user_id, amount::text as amount, type from public.transactions where id = ${res.json<{ id: string }>().id}`;
    expect(rows).toEqual([{ user_id: user.id, amount: '123.45', type: 'Expense' }]);
  });

  it('uses the given category, accepts neutral and a canonical amount for an integer input', async () => {
    const food = await categoryId(user, 'Food');
    const res = await call(user, 'POST', '/transactions', valid({ categoryId: food, neutral: true, amount: '10', type: 'Income' }));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ categoryId: food, categoryName: 'Alimentação', neutral: true, amount: '10.00', type: 'Income' });
  });

  it('stores the identifier as NULL for manual rows', async () => {
    const res = await call(user, 'POST', '/transactions', valid());
    const [row] = await getAdminSql()`
      select identifier, import_batch_id from public.transactions where id = ${res.json<{ id: string }>().id}`;
    expect(row).toEqual({ identifier: null, import_batch_id: null });
  });

  it.each([
    ['zero', '0'],
    ['zero with decimals', '0.00'],
    ['negative', '-5.00'],
    ['3 decimals', '1.234'],
    ['13 integer digits', '1000000000000'],
    ['not a number', 'abc'],
    ['empty', ''],
  ])('rejects an invalid amount (%s) with 422 invalid_amount', async (_label, amount) => {
    const res = await call(user, 'POST', '/transactions', valid({ amount }));
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { code: 'invalid_amount', message: expect.any(String), field: 'amount' } });
  });

  it.each(['name', 'type', 'occurredAt', 'paymentMethod'])('rejects an empty %s with 422 and the field', async (field) => {
    const res = await call(user, 'POST', '/transactions', valid({ [field]: '   ' }));
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: { field } });
  });

  it('rejects an empty accountId with 422 invalid_account', async () => {
    const res = await call(user, 'POST', '/transactions', valid({ accountId: '' }));
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: { code: 'invalid_account', field: 'accountId' } });
  });

  it('rejects a missing required field with 400 validation_error naming it', async () => {
    const withoutName: Record<string, unknown> = valid();
    delete withoutName.name;
    const res = await call(user, 'POST', '/transactions', withoutName);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'validation_error', field: 'name' } });
  });

  it('rejects unknown type/payment method values and an occurredAt without offset with 422', async () => {
    for (const [field, value] of [
      ['type', 'Transfer'],
      ['paymentMethod', 'Bitcoin'],
      ['occurredAt', '2026-10-05T14:30:00'],
      ['occurredAt', 'not-a-date'],
    ] as const) {
      const res = await call(user, 'POST', '/transactions', valid({ [field]: value }));
      expect(res.statusCode).toBe(422);
      expect(res.json()).toMatchObject({ error: { code: 'validation_error', field } });
    }
  });

  it('rejects an inactive account with 422 invalid_account and stores nothing', async () => {
    const inactive = await createAccount(user, 'Inativa');
    expect((await call(user, 'POST', `/accounts/${inactive}/deactivate`)).statusCode).toBe(200);
    const res = await call(user, 'POST', '/transactions', valid({ accountId: inactive, name: 'Em conta inativa' }));
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { code: 'invalid_account', message: expect.any(String), field: 'accountId' } });
    expect(await getAdminSql()`select 1 from public.transactions where name = 'Em conta inativa'`).toHaveLength(0);
  });

  it("rejects another user's account with 422 invalid_account, and an unknown or malformed one too", async () => {
    const other = await createTestUser();
    const foreign = await createAccount(other, 'Da outra');
    for (const id of [foreign, '00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const res = await call(user, 'POST', '/transactions', valid({ accountId: id }));
      expect(res.statusCode).toBe(422);
      expect(res.json()).toMatchObject({ error: { code: 'invalid_account' } });
    }
  });

  it('returns 404 not_found with field categoryId for an unknown, foreign or malformed category', async () => {
    const other = await createTestUser();
    const foreign = await categoryId(other, 'Food');
    for (const id of [foreign, '00000000-0000-4000-8000-000000000000', 'nope']) {
      const res = await call(user, 'POST', '/transactions', valid({ categoryId: id }));
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: { code: 'not_found', message: expect.any(String), field: 'categoryId' } });
    }
  });

  it.each([
    ['ftp://example.com/r', 'ftp'],
    ['javascript:alert(1)', 'javascript'],
    ['recibo-123', 'plain text'],
  ])('rejects an invalid receipt URL (%s) with 422 invalid_receipt_url', async (receipt) => {
    const res = await call(user, 'POST', '/transactions', valid({ receipt }));
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { code: 'invalid_receipt_url', message: expect.any(String), field: 'receipt' } });
  });

  it('treats blank notes and receipt as none', async () => {
    const res = await call(user, 'POST', '/transactions', valid({ notes: ' ', receipt: '' }));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ notes: null, receipt: null });
  });

  it('requires authentication', async () => {
    const res = await app.inject({ method: 'POST', url: '/transactions', payload: valid() });
    expect(res.statusCode).toBe(401);
  });
});

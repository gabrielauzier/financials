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
  accountId = await createAccount(user, 'Cartão');
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
  name: 'Notebook',
  totalAmount: '600.00',
  occurredAt: '2026-10-05T14:30:00-03:00',
  recurrencyDay: 10,
  status: 'Active',
  accountId,
  ...over,
});

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const storedCount = async (as: TestUser) =>
  (await getAdminSql()`select count(*)::int as n from public.credit_expenses where user_id = ${as.id}`)[0]?.n as number;

describe('POST /credit-expenses', () => {
  it('creates a credit expense (201) with paidAmount 0.00 when omitted, the Sem categoria default and the full shape', async () => {
    const res = await call(user, 'POST', '/credit-expenses', valid({ notes: 'em 12x' }));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: expect.stringMatching(UUID_SHAPE),
      accountId,
      categoryId: await categoryId(user, 'Uncategorized'),
      categoryName: 'Sem categoria',
      name: 'Notebook',
      totalAmount: '600.00',
      paidAmount: '0.00',
      remainingAmount: '600.00',
      occurredAt: '2026-10-05T17:30:00.000Z',
      recurrencyDay: 10,
      status: 'Active',
      notes: 'em 12x',
    });
    const [stored] = await getAdminSql()`
      select user_id, total_amount::text as total, paid_amount::text as paid, recurrency_day, status
      from public.credit_expenses where id = ${res.json<{ id: string }>().id}`;
    expect(stored).toEqual({ user_id: user.id, total: '600.00', paid: '0.00', recurrency_day: 10, status: 'Active' });
  });

  it('stores a paid amount, canonicalizes amounts to 2 decimals and returns the remaining amount', async () => {
    const res = await call(user, 'POST', '/credit-expenses', valid({ totalAmount: '600', paidAmount: '200.5' }));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ totalAmount: '600.00', paidAmount: '200.50', remainingAmount: '399.50' });
  });

  it('accepts paid 0 in any spelling, paid equal to the total, day 1 and 31, and each of the 5 statuses', async () => {
    for (const paidAmount of ['0', '0.0', '0.00', '00.00']) {
      const res = await call(user, 'POST', '/credit-expenses', valid({ paidAmount }));
      expect({ paidAmount, status: res.statusCode }).toEqual({ paidAmount, status: 201 });
      expect(res.json()).toMatchObject({ paidAmount: '0.00' });
    }
    const full = await call(user, 'POST', '/credit-expenses', valid({ paidAmount: '600.00' }));
    expect(full.statusCode).toBe(201);
    expect(full.json()).toMatchObject({ paidAmount: '600.00', remainingAmount: '0.00' });
    for (const recurrencyDay of [1, 31]) {
      expect((await call(user, 'POST', '/credit-expenses', valid({ recurrencyDay }))).statusCode).toBe(201);
    }
    for (const status of ['Once', 'Active', 'Inactive', 'Canceled', 'ToCancel']) {
      const res = await call(user, 'POST', '/credit-expenses', valid({ status }));
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ status });
    }
  });

  it('uses the given category and shows its name', async () => {
    const food = await categoryId(user, 'Food');
    const res = await call(user, 'POST', '/credit-expenses', valid({ categoryId: food }));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ categoryId: food, categoryName: 'Alimentação' });
  });

  it('stores blank or null notes as null and trims the name and notes', async () => {
    for (const notes of ['', '   ', null]) {
      const res = await call(user, 'POST', '/credit-expenses', valid({ notes }));
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ notes: null });
    }
    const res = await call(user, 'POST', '/credit-expenses', valid({ name: '  Netflix  ', notes: '  anual ' }));
    expect(res.json()).toMatchObject({ name: 'Netflix', notes: 'anual' });
  });

  it('stores the instant given with Z or any offset, and rejects a date-time without offset', async () => {
    const z = await call(user, 'POST', '/credit-expenses', valid({ occurredAt: '2026-10-05T00:00:00Z' }));
    expect(z.json()).toMatchObject({ occurredAt: '2026-10-05T00:00:00.000Z' });
    for (const occurredAt of ['2026-10-05T14:30:00', '2026-10-05', 'ontem', '']) {
      const res = await call(user, 'POST', '/credit-expenses', valid({ occurredAt }));
      expect({ occurredAt, status: res.statusCode }).toEqual({ occurredAt, status: 422 });
      expect(res.json()).toEqual({
        error: { code: 'validation_error', message: expect.any(String), field: 'occurredAt' },
      });
    }
  });

  it('rejects a total of zero, negative, with more than 2 decimals or malformed (422 invalid_amount on totalAmount)', async () => {
    const before = await storedCount(user);
    for (const totalAmount of ['0', '0.00', '-1.00', '10.001', '1e3', ' 10.00', '', 'abc', '1,50', '1000000000000.00']) {
      const res = await call(user, 'POST', '/credit-expenses', valid({ totalAmount }));
      expect({ totalAmount, status: res.statusCode }).toEqual({ totalAmount, status: 422 });
      expect(res.json()).toEqual({
        error: { code: 'invalid_amount', message: expect.any(String), field: 'totalAmount' },
      });
    }
    expect(await storedCount(user)).toBe(before);
  });

  it('rejects a total or paid amount that is not a JSON string, without coercing it (L-005)', async () => {
    const before = await storedCount(user);
    for (const bad of [600, 600.5, true, null, {}, [], ['600.00']]) {
      const total = await call(user, 'POST', '/credit-expenses', valid({ totalAmount: bad }));
      expect({ bad, status: total.statusCode }).toEqual({ bad, status: 422 });
      expect(total.json()).toMatchObject({ error: { code: 'invalid_amount', field: 'totalAmount' } });
      const paid = await call(user, 'POST', '/credit-expenses', valid({ paidAmount: bad }));
      expect({ bad, status: paid.statusCode }).toEqual({ bad, status: 422 });
      expect(paid.json()).toMatchObject({ error: { code: 'invalid_paid_amount', field: 'paidAmount' } });
    }
    expect(await storedCount(user)).toBe(before);
  });

  it('does not round a long JSON number sent as the total (raw body 12345678901.239999999)', async () => {
    const before = await storedCount(user);
    const raw = JSON.stringify(valid()).replace('"600.00"', '12345678901.239999999');
    const res = await app.inject({
      method: 'POST',
      url: '/credit-expenses',
      headers: { authorization: `Bearer ${user.token}`, 'content-type': 'application/json' },
      payload: raw,
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: { code: 'invalid_amount', field: 'totalAmount' } });
    expect(await storedCount(user)).toBe(before);
  });

  it('rejects a paid amount below 0, above the total or malformed (422 invalid_paid_amount on paidAmount)', async () => {
    const before = await storedCount(user);
    for (const paidAmount of ['-0.01', '-1', '600.01', '1000000', '10.001', '', 'abc', ' 5.00']) {
      const res = await call(user, 'POST', '/credit-expenses', valid({ totalAmount: '600.00', paidAmount }));
      expect({ paidAmount, status: res.statusCode }).toEqual({ paidAmount, status: 422 });
      expect(res.json()).toEqual({
        error: { code: 'invalid_paid_amount', message: expect.any(String), field: 'paidAmount' },
      });
    }
    expect(await storedCount(user)).toBe(before);
  });

  it('rejects a recurrency day that is not an integer from 1 to 31 (422 invalid_day on recurrencyDay)', async () => {
    const before = await storedCount(user);
    for (const recurrencyDay of [0, 32, -1, 5.5, 100, '5', '', null, true, {}, 1e21]) {
      const res = await call(user, 'POST', '/credit-expenses', valid({ recurrencyDay }));
      expect({ recurrencyDay, status: res.statusCode }).toEqual({ recurrencyDay, status: 422 });
      expect(res.json()).toEqual({
        error: { code: 'invalid_day', message: expect.any(String), field: 'recurrencyDay' },
      });
    }
    expect(await storedCount(user)).toBe(before);
  });

  it('rejects a status outside the list, in any letter case (422 invalid_status on status)', async () => {
    const before = await storedCount(user);
    for (const status of ['Paused', 'active', 'ACTIVE', '', ' Active']) {
      const res = await call(user, 'POST', '/credit-expenses', valid({ status }));
      expect({ status, code: res.statusCode }).toEqual({ status, code: 422 });
      expect(res.json()).toEqual({
        error: { code: 'invalid_status', message: expect.any(String), field: 'status' },
      });
    }
    expect(await storedCount(user)).toBe(before);
  });

  it('rejects a blank name with 422 validation_error on name', async () => {
    const res = await call(user, 'POST', '/credit-expenses', valid({ name: '   ' }));
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { code: 'validation_error', message: expect.any(String), field: 'name' } });
  });

  it('rejects an inactive account with 422 invalid_account, and stores nothing', async () => {
    const inactive = await createAccount(user, 'Inativa');
    expect((await call(user, 'POST', `/accounts/${inactive}/deactivate`)).statusCode).toBe(200);
    const before = await storedCount(user);
    const res = await call(user, 'POST', '/credit-expenses', valid({ accountId: inactive }));
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { code: 'invalid_account', message: expect.any(String), field: 'accountId' } });
    expect(await storedCount(user)).toBe(before);
  });

  it('rejects an unknown or malformed account with 422 invalid_account', async () => {
    for (const bad of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const res = await call(user, 'POST', '/credit-expenses', valid({ accountId: bad }));
      expect({ bad, status: res.statusCode }).toEqual({ bad, status: 422 });
      expect(res.json()).toMatchObject({ error: { code: 'invalid_account', field: 'accountId' } });
    }
  });

  it('rejects an unknown or malformed category with 404 not_found on categoryId', async () => {
    for (const bad of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const res = await call(user, 'POST', '/credit-expenses', valid({ categoryId: bad }));
      expect({ bad, status: res.statusCode }).toEqual({ bad, status: 404 });
      expect(res.json()).toMatchObject({ error: { code: 'not_found', field: 'categoryId' } });
    }
  });

  it('answers 400 validation_error when a required key is missing, and stores nothing', async () => {
    const before = await storedCount(user);
    for (const key of ['name', 'totalAmount', 'occurredAt', 'recurrencyDay', 'status', 'accountId']) {
      const body: Record<string, unknown> = valid();
      delete body[key];
      const res = await call(user, 'POST', '/credit-expenses', body);
      expect({ key, status: res.statusCode }).toEqual({ key, status: 400 });
      expect(res.json()).toMatchObject({ error: { code: 'validation_error', field: key } });
    }
    expect(await storedCount(user)).toBe(before);
  });

  it('stores status and paid amount exactly as sent (no automatic rule)', async () => {
    const res = await call(user, 'POST', '/credit-expenses', valid({ status: 'Canceled', paidAmount: '600.00' }));
    expect(res.json()).toMatchObject({ status: 'Canceled', paidAmount: '600.00' });
  });
});

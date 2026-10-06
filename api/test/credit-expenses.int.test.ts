import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { registerCategoryReference } from '../src/modules/categories/registry.js';
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

describe('GET /credit-expenses', () => {
  let u: TestUser;
  let account: string;
  const ids: Record<string, string> = {};

  async function create(over: Record<string, unknown>): Promise<string> {
    const res = await call(u, 'POST', '/credit-expenses', valid({ accountId: account, ...over }));
    expect(res.statusCode).toBe(201);
    return res.json<{ id: string }>().id;
  }

  beforeAll(async () => {
    u = await createTestUser();
    account = await createAccount(u, 'Listagem');
    // One row per status, with distinct dates (Once is the oldest) and the spec example amounts.
    ids.Once = await create({ name: 'Once', status: 'Once', occurredAt: '2026-01-01T12:00:00Z' });
    ids.Active = await create({
      name: 'Active', status: 'Active', occurredAt: '2026-02-01T12:00:00Z', totalAmount: '600.00', paidAmount: '200.00',
    });
    ids.Inactive = await create({ name: 'Inactive', status: 'Inactive', occurredAt: '2026-03-01T12:00:00Z' });
    ids.Canceled = await create({ name: 'Canceled', status: 'Canceled', occurredAt: '2026-04-01T12:00:00Z' });
    ids.ToCancel = await create({ name: 'ToCancel', status: 'ToCancel', occurredAt: '2026-05-01T12:00:00Z' });
  });

  async function list(query = '') {
    const res = await call(u, 'GET', `/credit-expenses${query}`);
    expect(res.statusCode).toBe(200);
    return res.json<{ id: string; name: string; status: string; remainingAmount: string }[]>();
  }

  it('returns an empty array for a user with no credit expenses', async () => {
    const empty = await createTestUser();
    const res = await call(empty, 'GET', '/credit-expenses');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('computes remainingAmount as total minus paid: 600.00 and 200.00 give 400.00', async () => {
    const row = (await list()).find((r) => r.id === ids.Active);
    expect(row).toMatchObject({ totalAmount: '600.00', paidAmount: '200.00', remainingAmount: '400.00' });
  });

  it('computes remainingAmount exactly for cents, no float drift, and 0.00 when fully paid', async () => {
    const cents = await create({ name: 'Centavos', totalAmount: '0.30', paidAmount: '0.10' });
    const full = await create({ name: 'Quitada', totalAmount: '999999999999.99', paidAmount: '999999999999.99' });
    const big = await create({ name: 'Grande', totalAmount: '999999999999.99', paidAmount: '0.01' });
    const rows = await list();
    expect(rows.find((r) => r.id === cents)?.remainingAmount).toBe('0.20');
    expect(rows.find((r) => r.id === full)?.remainingAmount).toBe('0.00');
    expect(rows.find((r) => r.id === big)?.remainingAmount).toBe('999999999999.98');
  });

  it('lists every row with the full shape, newest occurredAt first', async () => {
    const rows = await call(u, 'GET', '/credit-expenses');
    const body = rows.json<{ id: string; occurredAt: string }[]>();
    const dates = body.map((r) => r.occurredAt);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(body.find((r) => r.id === ids.ToCancel)).toEqual({
      id: ids.ToCancel,
      accountId: account,
      categoryId: await categoryId(u, 'Uncategorized'),
      categoryName: 'Sem categoria',
      name: 'ToCancel',
      totalAmount: '600.00',
      paidAmount: '0.00',
      remainingAmount: '600.00',
      occurredAt: '2026-05-01T12:00:00.000Z',
      recurrencyDay: 10,
      status: 'ToCancel',
      notes: null,
    });
  });

  it('breaks ties between equal dates by id, descending', async () => {
    const same = '2027-01-01T12:00:00Z';
    const a = await create({ name: 'Empate A', occurredAt: same });
    const b = await create({ name: 'Empate B', occurredAt: same });
    const tied = (await list()).filter((r) => r.id === a || r.id === b).map((r) => r.id);
    expect(tied).toEqual([a, b].sort().reverse());
  });

  it.each(['Once', 'Active', 'Inactive', 'Canceled', 'ToCancel'])('filters by status %s, returning only that status', async (status) => {
    const rows = await list(`?status=${status}`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.status === status)).toBe(true);
    expect(rows.map((r) => r.id)).toContain(ids[status]);
    // Rows of the other statuses exist but are not returned.
    const everything = await list();
    expect(rows.length).toBe(everything.filter((r) => r.status === status).length);
    expect(everything.length).toBeGreaterThan(rows.length);
  });

  it('rejects a status outside the list, in any letter case or empty, with 422 invalid_status', async () => {
    for (const status of ['Paused', 'active', '', 'Active%20']) {
      const res = await call(u, 'GET', `/credit-expenses?status=${status}`);
      expect({ status, code: res.statusCode }).toEqual({ status, code: 422 });
      expect(res.json()).toEqual({ error: { code: 'invalid_status', message: expect.any(String), field: 'status' } });
    }
  });

  it('returns only rows of the caller', async () => {
    const other = await createTestUser();
    const otherAccount = await createAccount(other, 'Outra');
    await call(other, 'POST', '/credit-expenses', valid({ accountId: otherAccount, name: 'Da outra' }));
    expect((await list()).map((r) => r.name)).not.toContain('Da outra');
  });
});

describe('PATCH /credit-expenses/:id', () => {
  let u: TestUser;
  let account: string;

  beforeAll(async () => {
    u = await createTestUser();
    account = await createAccount(u, 'Edição');
  });

  type Item = Record<string, unknown> & { id: string };

  async function create(over: Record<string, unknown> = {}): Promise<Item> {
    const res = await call(
      u,
      'POST',
      '/credit-expenses',
      valid({ accountId: account, totalAmount: '600.00', paidAmount: '200.00', notes: 'original', ...over }),
    );
    expect(res.statusCode).toBe(201);
    return res.json<Item>();
  }

  const patch = (id: string, body: unknown) => call(u, 'PATCH', `/credit-expenses/${id}`, body);

  async function read(id: string): Promise<Item | undefined> {
    const res = await call(u, 'GET', '/credit-expenses');
    return res.json<Item[]>().find((r) => r.id === id);
  }

  const STATUSES = ['Once', 'Active', 'Inactive', 'Canceled', 'ToCancel'];

  it('changes any status to any other status, leaving paidAmount and every other field untouched', async () => {
    for (const from of STATUSES) {
      const item = await create({ name: `De ${from}`, status: from });
      for (const to of STATUSES) {
        const res = await patch(item.id, { status: to });
        expect({ from, to, status: res.statusCode }).toEqual({ from, to, status: 200 });
        expect(res.json()).toEqual({ ...item, status: to });
        expect(await read(item.id)).toEqual({ ...item, status: to });
      }
    }
  });

  it.each<[string, Record<string, unknown>, Record<string, unknown>]>([
    ['name', { name: '  Novo nome ' }, { name: 'Novo nome' }],
    ['totalAmount', { totalAmount: '800' }, { totalAmount: '800.00', remainingAmount: '600.00' }],
    ['paidAmount', { paidAmount: '350.25' }, { paidAmount: '350.25', remainingAmount: '249.75' }],
    ['occurredAt', { occurredAt: '2026-11-20T08:00:00-03:00' }, { occurredAt: '2026-11-20T11:00:00.000Z' }],
    ['recurrencyDay', { recurrencyDay: 28 }, { recurrencyDay: 28 }],
    ['notes', { notes: 'outra' }, { notes: 'outra' }],
  ])('edits only %s and preserves every other field by value', async (_field, body, expected) => {
    const item = await create();
    const res = await patch(item.id, body);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ...item, ...expected });
    expect(await read(item.id)).toEqual({ ...item, ...expected });
    // Status and paid amount are never touched by an edit of another field.
    expect(res.json()).toMatchObject({ status: item.status });
    if (!('paidAmount' in body)) expect(res.json()).toMatchObject({ paidAmount: '200.00' });
  });

  it('edits several fields in one request and keeps the rest', async () => {
    const item = await create();
    const res = await patch(item.id, { name: 'Dois', recurrencyDay: 3, status: 'ToCancel', notes: 'x' });
    expect(res.json()).toEqual({ ...item, name: 'Dois', recurrencyDay: 3, status: 'ToCancel', notes: 'x' });
  });

  it('clears notes with null or blank text', async () => {
    for (const notes of [null, '', '   ']) {
      const item = await create();
      const res = await patch(item.id, { notes });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ...item, notes: null });
    }
  });

  it('changes the category and shows its name, and keeps it when not sent', async () => {
    const item = await create();
    const food = await categoryId(u, 'Food');
    const res = await patch(item.id, { categoryId: food });
    expect(res.json()).toEqual({ ...item, categoryId: food, categoryName: 'Alimentação' });
    expect(await patch(item.id, { name: 'Mesma categoria' })).toMatchObject({ statusCode: 200 });
    expect(await read(item.id)).toMatchObject({ categoryId: food, categoryName: 'Alimentação' });
  });

  it('returns the current row for an empty body, changing nothing', async () => {
    const item = await create();
    const res = await patch(item.id, {});
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(item);
    expect(await read(item.id)).toEqual(item);
  });

  it('rejects lowering totalAmount below the paid amount with 422 invalid_paid_amount, keeping the row', async () => {
    const item = await create();
    for (const totalAmount of ['199.99', '0.01']) {
      const res = await patch(item.id, { totalAmount });
      expect({ totalAmount, status: res.statusCode }).toEqual({ totalAmount, status: 422 });
      expect(res.json()).toEqual({
        error: { code: 'invalid_paid_amount', message: expect.any(String), field: 'paidAmount' },
      });
    }
    expect(await read(item.id)).toEqual(item);
  });

  it('accepts lowering totalAmount down to exactly the paid amount', async () => {
    const item = await create();
    const res = await patch(item.id, { totalAmount: '200.00' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ...item, totalAmount: '200.00', remainingAmount: '0.00' });
  });

  it('rejects a paidAmount above the current total with 422 invalid_paid_amount, accepting up to the total', async () => {
    const item = await create();
    const over = await patch(item.id, { paidAmount: '600.01' });
    expect(over.statusCode).toBe(422);
    expect(over.json()).toEqual({
      error: { code: 'invalid_paid_amount', message: expect.any(String), field: 'paidAmount' },
    });
    expect(await read(item.id)).toEqual(item);
    const full = await patch(item.id, { paidAmount: '600.00' });
    expect(full.json()).toMatchObject({ paidAmount: '600.00', remainingAmount: '0.00' });
  });

  it('validates paid against the resulting total when both change in one request', async () => {
    const item = await create();
    const ok = await patch(item.id, { totalAmount: '100.00', paidAmount: '90.00' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ totalAmount: '100.00', paidAmount: '90.00', remainingAmount: '10.00' });
    const bad = await patch(item.id, { totalAmount: '50.00', paidAmount: '90.00' });
    expect(bad.statusCode).toBe(422);
    expect(bad.json()).toMatchObject({ error: { code: 'invalid_paid_amount', field: 'paidAmount' } });
    // Raising the total together with the paid amount is allowed even above the old total.
    const raise = await patch(item.id, { totalAmount: '1000.00', paidAmount: '900.00' });
    expect(raise.json()).toMatchObject({ totalAmount: '1000.00', paidAmount: '900.00' });
  });

  it('applies the field validations of create to each editable field, keeping the row unchanged', async () => {
    const item = await create();
    const cases: [Record<string, unknown>, number, string, string][] = [
      [{ totalAmount: '0' }, 422, 'invalid_amount', 'totalAmount'],
      [{ totalAmount: '-1.00' }, 422, 'invalid_amount', 'totalAmount'],
      [{ totalAmount: '10.001' }, 422, 'invalid_amount', 'totalAmount'],
      [{ totalAmount: 600 }, 422, 'invalid_amount', 'totalAmount'],
      [{ totalAmount: null }, 422, 'invalid_amount', 'totalAmount'],
      [{ paidAmount: '-0.01' }, 422, 'invalid_paid_amount', 'paidAmount'],
      [{ paidAmount: 5 }, 422, 'invalid_paid_amount', 'paidAmount'],
      [{ paidAmount: null }, 422, 'invalid_paid_amount', 'paidAmount'],
      [{ recurrencyDay: 0 }, 422, 'invalid_day', 'recurrencyDay'],
      [{ recurrencyDay: 32 }, 422, 'invalid_day', 'recurrencyDay'],
      [{ recurrencyDay: 5.5 }, 422, 'invalid_day', 'recurrencyDay'],
      [{ recurrencyDay: '5' }, 422, 'invalid_day', 'recurrencyDay'],
      [{ recurrencyDay: null }, 422, 'invalid_day', 'recurrencyDay'],
      [{ status: 'Paused' }, 422, 'invalid_status', 'status'],
      [{ status: 'active' }, 422, 'invalid_status', 'status'],
      [{ status: '' }, 422, 'invalid_status', 'status'],
      [{ name: '   ' }, 422, 'validation_error', 'name'],
      [{ occurredAt: '2026-10-05T14:30:00' }, 422, 'validation_error', 'occurredAt'],
    ];
    for (const [body, status, code, field] of cases) {
      const res = await patch(item.id, body);
      expect({ body, status: res.statusCode }).toEqual({ body, status });
      expect(res.json()).toEqual({ error: { code, message: expect.any(String), field } });
    }
    expect(await read(item.id)).toEqual(item);
  });

  it('does not round a long JSON number sent as the total (raw body)', async () => {
    const item = await create();
    const res = await app.inject({
      method: 'PATCH',
      url: `/credit-expenses/${item.id}`,
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' },
      payload: '{"totalAmount": 12345678901.239999999}',
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: { code: 'invalid_amount', field: 'totalAmount' } });
    expect(await read(item.id)).toEqual(item);
  });

  it('keeps a row of an inactive account editable, and allows moving it to another account of the user', async () => {
    const own = await createAccount(u, 'Vai ser inativada');
    const item = await create({ accountId: own });
    expect((await call(u, 'POST', `/accounts/${own}/deactivate`)).statusCode).toBe(200);

    const edited = await patch(item.id, { name: 'Editada em conta inativa', status: 'Canceled' });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toEqual({ ...item, name: 'Editada em conta inativa', status: 'Canceled' });
    // The row is still listed.
    expect(await read(item.id)).toMatchObject({ accountId: own });

    // Creation requires an active account; an edit may move the row to an inactive one.
    const another = await createAccount(u, 'Também inativa');
    expect((await call(u, 'POST', `/accounts/${another}/deactivate`)).statusCode).toBe(200);
    const moved = await patch(item.id, { accountId: another });
    expect(moved.statusCode).toBe(200);
    expect(moved.json()).toMatchObject({ accountId: another });
    const back = await patch(item.id, { accountId: account });
    expect(back.json()).toMatchObject({ accountId: account });
  });

  it('rejects an unknown or malformed account with 422 invalid_account and an unknown category with 404', async () => {
    const item = await create();
    for (const bad of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const acc = await patch(item.id, { accountId: bad });
      expect({ bad, status: acc.statusCode }).toEqual({ bad, status: 422 });
      expect(acc.json()).toMatchObject({ error: { code: 'invalid_account', field: 'accountId' } });
      const cat = await patch(item.id, { categoryId: bad });
      expect({ bad, status: cat.statusCode }).toEqual({ bad, status: 404 });
      expect(cat.json()).toMatchObject({ error: { code: 'not_found', field: 'categoryId' } });
    }
    expect(await read(item.id)).toEqual(item);
  });

  it('answers 404 for an unknown or malformed id, for any body', async () => {
    for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      for (const body of [{}, { name: 'X' }, { status: 'Active' }]) {
        const res = await patch(id, body);
        expect({ id, body, status: res.statusCode }).toEqual({ id, body, status: 404 });
        expect(res.json()).toEqual({ error: { code: 'not_found', message: expect.any(String) } });
      }
    }
  });

  it('never changes status or paid amount by itself across a sequence of edits', async () => {
    const item = await create({ status: 'ToCancel', totalAmount: '600.00', paidAmount: '600.00' });
    for (const body of [{ totalAmount: '600.00' }, { name: 'a' }, { recurrencyDay: 2 }, { notes: null }, {}]) {
      const res = await patch(item.id, body);
      expect(res.json()).toMatchObject({ status: 'ToCancel', paidAmount: '600.00', remainingAmount: '0.00' });
    }
  });
});

describe('DELETE /credit-expenses/:id', () => {
  let u: TestUser;
  let account: string;

  beforeAll(async () => {
    u = await createTestUser();
    account = await createAccount(u, 'Exclusão');
  });

  async function create(name: string, over: Record<string, unknown> = {}): Promise<string> {
    const res = await call(u, 'POST', '/credit-expenses', valid({ accountId: account, name, ...over }));
    expect(res.statusCode).toBe(201);
    return res.json<{ id: string }>().id;
  }

  const ids = async () =>
    (await call(u, 'GET', '/credit-expenses')).json<{ id: string }[]>().map((r) => r.id);
  const storedIds = async () =>
    (await getAdminSql()`select id from public.credit_expenses where user_id = ${u.id}`).map((r) => r.id as string);

  it('deletes an existing row (204, empty body), only that row, definitively', async () => {
    const target = await create('Apagar');
    const kept = await create('Manter');
    const res = await call(u, 'DELETE', `/credit-expenses/${target}`);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(await ids()).not.toContain(target);
    expect(await ids()).toContain(kept);
    expect(await storedIds()).not.toContain(target);
    expect(await storedIds()).toContain(kept);
  });

  it('answers 404 not_found for an unknown id and for a malformed id, deleting nothing', async () => {
    const kept = await create('Intacta');
    const before = await storedIds();
    for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const res = await call(u, 'DELETE', `/credit-expenses/${id}`);
      expect({ id, status: res.statusCode }).toEqual({ id, status: 404 });
      expect(res.json()).toEqual({ error: { code: 'not_found', message: expect.any(String) } });
    }
    expect(await storedIds()).toEqual(before);
    expect(await ids()).toContain(kept);
  });

  it('answers 404 when deleting the same row twice', async () => {
    const target = await create('Duas vezes');
    expect((await call(u, 'DELETE', `/credit-expenses/${target}`)).statusCode).toBe(204);
    const again = await call(u, 'DELETE', `/credit-expenses/${target}`);
    expect(again.statusCode).toBe(404);
    expect(again.json()).toMatchObject({ error: { code: 'not_found' } });
  });

  it("answers 404 for another user's row and leaves it in place", async () => {
    const mine = await create('Minha');
    const other = await createTestUser();
    const res = await call(other, 'DELETE', `/credit-expenses/${mine}`);
    expect(res.statusCode).toBe(404);
    expect(await storedIds()).toContain(mine);
  });

  it('deletes a row of an inactive account and a row of any status, and a patch afterwards answers 404', async () => {
    const own = await createAccount(u, 'Inativa p/ exclusão');
    const inactiveRow = await create('Em conta inativa', { accountId: own });
    expect((await call(u, 'POST', `/accounts/${own}/deactivate`)).statusCode).toBe(200);
    expect((await call(u, 'DELETE', `/credit-expenses/${inactiveRow}`)).statusCode).toBe(204);
    for (const status of ['Once', 'Active', 'Inactive', 'Canceled', 'ToCancel']) {
      const id = await create(`Status ${status}`, { status, paidAmount: '600.00' });
      expect((await call(u, 'DELETE', `/credit-expenses/${id}`)).statusCode).toBe(204);
      expect((await call(u, 'PATCH', `/credit-expenses/${id}`, { name: 'Fantasma' })).statusCode).toBe(404);
    }
  });
});

describe('DELETE /categories/:id with credit expenses (reassignment)', () => {
  let u: TestUser;
  let account: string;

  beforeAll(async () => {
    u = await createTestUser();
    account = await createAccount(u, 'Reatribuição');
  });

  async function createIn(category: string, name: string): Promise<string> {
    const res = await call(u, 'POST', '/credit-expenses', valid({ accountId: account, categoryId: category, name }));
    expect(res.statusCode).toBe(201);
    return res.json<{ id: string }>().id;
  }

  async function newCategory(name: string): Promise<string> {
    const res = await call(u, 'POST', '/categories', { name });
    expect(res.statusCode).toBe(201);
    return res.json<{ id: string }>().id;
  }

  async function shown(ids: string[]): Promise<{ categoryId: string; categoryName: string }[]> {
    const items = (await call(u, 'GET', '/credit-expenses')).json<
      { id: string; categoryId: string; categoryName: string }[]
    >();
    return ids.map((id) => {
      const row = items.find((r) => r.id === id);
      return { categoryId: row?.categoryId ?? 'missing', categoryName: row?.categoryName ?? 'missing' };
    });
  }

  const categoryExists = async (id: string) =>
    (await getAdminSql()`select 1 from public.categories where id = ${id}`).length === 1;

  it('requires reassignTo for a category with credit expenses (422 reassign_required), keeping it and its rows', async () => {
    const viagem = await newCategory('Viagem');
    const ids = [await createIn(viagem, 'Hotel'), await createIn(viagem, 'Passagem')];

    const res = await call(u, 'DELETE', `/categories/${viagem}`);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { code: 'reassign_required', message: expect.any(String), field: 'reassignTo' } });
    expect(await categoryExists(viagem)).toBe(true);
    expect(await shown(ids)).toEqual([
      { categoryId: viagem, categoryName: 'Viagem' },
      { categoryId: viagem, categoryName: 'Viagem' },
    ]);
  });

  it('moves the credit expenses to reassignTo, deletes the category and the list shows the destination name', async () => {
    const academia = await newCategory('Academia');
    const health = await categoryId(u, 'Healthcare');
    const food = await categoryId(u, 'Food');
    const moved = [await createIn(academia, 'Mensalidade'), await createIn(academia, 'Personal')];
    const kept = await createIn(food, 'Almoço');

    const res = await call(u, 'DELETE', `/categories/${academia}?reassignTo=${health}`);
    expect(res.statusCode).toBe(204);
    expect(await categoryExists(academia)).toBe(false);
    expect(await shown(moved)).toEqual([
      { categoryId: health, categoryName: 'Saúde' },
      { categoryId: health, categoryName: 'Saúde' },
    ]);
    expect(await shown([kept])).toEqual([{ categoryId: food, categoryName: 'Alimentação' }]);
  });

  it('keeps the category and every credit expense unchanged when the delete fails', async () => {
    const curso = await newCategory('Curso');
    const ids = [await createIn(curso, 'Aula 1'), await createIn(curso, 'Aula 2')];
    const before = [
      { categoryId: curso, categoryName: 'Curso' },
      { categoryId: curso, categoryName: 'Curso' },
    ];

    // Rejected destination: nothing moves.
    const unknown = await call(u, 'DELETE', `/categories/${curso}?reassignTo=00000000-0000-4000-8000-000000000000`);
    expect(unknown.statusCode).toBe(404);
    expect(await shown(ids)).toEqual(before);

    // Failure after the credit expenses were moved: a table registered after them raises, and the
    // whole operation rolls back.
    const sql = getAdminSql();
    const probe = 'public.ce_reassign_probe_failing';
    await sql`drop table if exists ${sql(probe)}`;
    await sql`
      create table ${sql(probe)} (
        id bigint generated always as identity primary key,
        user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
        category_id uuid not null,
        foreign key (category_id, user_id) references public.categories (id, user_id)
      )`;
    await sql`alter table ${sql(probe)} enable row level security`;
    await sql`
      create policy probe_all on ${sql(probe)} for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))`;
    await sql`grant select, insert, update, delete on ${sql(probe)} to authenticated`;
    await sql`
      create or replace function public.ce_reassign_probe_fail() returns trigger
      language plpgsql as $$ begin raise exception 'reassignment failure probe'; end $$`;
    await sql`
      create trigger ce_reassign_probe_fail before update on ${sql(probe)}
      for each row execute function public.ce_reassign_probe_fail()`;
    await sql`insert into ${sql(probe)} (user_id, category_id) values (${u.id}, ${curso})`;
    const unregister = registerCategoryReference({ table: probe, column: 'category_id' });
    try {
      const res = await call(u, 'DELETE', `/categories/${curso}?reassignTo=${await categoryId(u, 'Food')}`);
      expect(res.statusCode).toBe(500);
    } finally {
      unregister();
      await sql`drop table if exists ${sql(probe)}`;
      await sql`drop function if exists public.ce_reassign_probe_fail()`;
    }
    expect(await categoryExists(curso)).toBe(true);
    expect(await shown(ids)).toEqual(before);
  });
});

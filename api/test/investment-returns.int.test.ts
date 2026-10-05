import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { get, seedAccount, send, startApp, type ReturnJson } from './helpers/dashboards.js';

let app: FastifyInstance;
let user: TestUser;
let other: TestUser;
let accountId: string;
let otherAccountId: string;

beforeAll(async () => {
  app = await startApp();
  user = await createTestUser();
  other = await createTestUser();
  accountId = await seedAccount(user, 'Corretora');
  otherAccountId = await seedAccount(other, 'Do outro');
});

afterAll(async () => {
  await app.close();
  await cleanupTestUsers();
  await closeAdminSql();
});

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const valid = (over: Record<string, unknown> = {}) => ({ occurredOn: '2026-10-01', amount: '50.00', accountId, ...over });
const storedCount = async (as: TestUser) =>
  (await getAdminSql()`select count(*)::int as n from public.investment_returns where user_id = ${as.id}`)[0]?.n as number;

describe('POST /investment-returns (DASH-06.1, DASH-06.2)', () => {
  it('creates a positive return (201) with the full wire shape', async () => {
    const res = await send(app, user, 'POST', '/investment-returns', valid({ notes: 'CDB' }));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: expect.stringMatching(UUID_SHAPE),
      accountId,
      accountNickname: 'Corretora',
      occurredOn: '2026-10-01',
      amount: '50.00',
      notes: 'CDB',
    });
  });

  it('creates a negative return and canonicalizes the amount to 2 decimals', async () => {
    const res = await send(app, user, 'POST', '/investment-returns', valid({ amount: '-20.5' }));
    expect(res.statusCode).toBe(201);
    expect(res.json<ReturnJson>()).toMatchObject({ amount: '-20.50', notes: null });
    const whole = await send(app, user, 'POST', '/investment-returns', valid({ amount: '7' }));
    expect(whole.json<ReturnJson>().amount).toBe('7.00');
  });

  it('accepts the largest amount (12 integer digits) and rejects 13', async () => {
    const ok = await send(app, user, 'POST', '/investment-returns', valid({ amount: '-999999999999.99' }));
    expect(ok.statusCode).toBe(201);
    const bad = await send(app, user, 'POST', '/investment-returns', valid({ amount: '1000000000000' }));
    expect(bad.statusCode).toBe(422);
    expect(bad.json()).toMatchObject({ error: { code: 'invalid_amount', field: 'amount' } });
  });

  it('rejects zero in every spelling with 422 invalid_amount and stores nothing', async () => {
    const before = await storedCount(user);
    for (const amount of ['0', '0.00', '-0', '-0.00', '00.0']) {
      const res = await send(app, user, 'POST', '/investment-returns', valid({ amount }));
      expect({ amount, status: res.statusCode }).toEqual({ amount, status: 422 });
      expect(res.json()).toMatchObject({ error: { code: 'invalid_amount', field: 'amount' } });
    }
    expect(await storedCount(user)).toBe(before);
  });

  it('rejects 3 decimals, a JSON number, malformed strings and a missing amount with 422', async () => {
    for (const amount of ['1.234', '-1.005', 50, -20.5, 0, null, true, '', '+5', ' 5', '1,5', 'abc', '-', '--5']) {
      const res = await send(app, user, 'POST', '/investment-returns', valid({ amount }));
      expect({ amount, status: res.statusCode }).toEqual({ amount, status: 422 });
      expect(res.json()).toMatchObject({ error: { field: 'amount' } });
    }
    const missing = await send(app, user, 'POST', '/investment-returns', { occurredOn: '2026-10-01', accountId });
    // A missing required field is a schema error (400), like in the other modules.
    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toMatchObject({ error: { field: 'amount' } });
  });

  it('rejects a foreign or unknown account (or a malformed id) with 422 invalid_account', async () => {
    const before = await storedCount(user);
    for (const id of [otherAccountId, '00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const res = await send(app, user, 'POST', '/investment-returns', valid({ accountId: id }));
      expect({ id, status: res.statusCode }).toEqual({ id, status: 422 });
      expect(res.json()).toMatchObject({ error: { code: 'invalid_account', field: 'accountId' } });
    }
    expect(await storedCount(user)).toBe(before);
    expect(await storedCount(other)).toBe(0);
  });

  it('accepts an inactive account of the user', async () => {
    const inactive = await seedAccount(user, 'Encerrada', false);
    const res = await send(app, user, 'POST', '/investment-returns', valid({ accountId: inactive }));
    expect(res.statusCode).toBe(201);
    expect(res.json<ReturnJson>().accountNickname).toBe('Encerrada');
  });

  it('rejects invalid or nonexistent dates with 422 invalid_date', async () => {
    for (const occurredOn of ['2026-02-30', '2026-13-01', '01/10/2026', '2026-10-01T10:00:00Z', '', 'x', 20261001]) {
      const res = await send(app, user, 'POST', '/investment-returns', valid({ occurredOn }));
      expect({ occurredOn, status: res.statusCode }).toEqual({ occurredOn, status: 422 });
      expect(res.json()).toMatchObject({ error: { field: 'occurredOn' } });
    }
    const bad = await send(app, user, 'POST', '/investment-returns', valid({ occurredOn: '2026-02-30' }));
    expect(bad.json()).toMatchObject({ error: { code: 'invalid_date' } });
  });

  it('stores blank notes as null', async () => {
    const res = await send(app, user, 'POST', '/investment-returns', valid({ notes: '   ' }));
    expect(res.json<ReturnJson>().notes).toBeNull();
  });

  it('answers 401 without a token', async () => {
    const res = await app.inject({ method: 'POST', url: '/investment-returns', payload: valid() });
    expect(res.statusCode).toBe(401);
  });
});

interface ListJson {
  items: ReturnJson[];
  lastDate: string | null;
}

async function list(as: TestUser): Promise<ListJson> {
  const res = await get(app, as, '/investment-returns');
  expect(res.statusCode).toBe(200);
  return res.json<ListJson>();
}

describe('GET /investment-returns (DASH-06.4, DASH-06.6)', () => {
  it('returns an empty list with lastDate null for a user without returns', async () => {
    const fresh = await createTestUser();
    expect(await list(fresh)).toEqual({ items: [], lastDate: null });
  });

  it('orders by date descending and lastDate is the newest date, whatever the insertion order', async () => {
    const u = await createTestUser();
    const acc = await seedAccount(u, 'Cofre');
    for (const [occurredOn, amount] of [['2026-03-10', '10.00'], ['2026-09-30', '-5.00'], ['2026-01-02', '1.50']] as const) {
      const res = await send(app, u, 'POST', '/investment-returns', { occurredOn, amount, accountId: acc });
      expect(res.statusCode).toBe(201);
    }
    const { items, lastDate } = await list(u);
    expect(items.map((r) => [r.occurredOn, r.amount])).toEqual([
      ['2026-09-30', '-5.00'],
      ['2026-03-10', '10.00'],
      ['2026-01-02', '1.50'],
    ]);
    expect(items[0]).toMatchObject({ accountId: acc, accountNickname: 'Cofre', notes: null });
    expect(lastDate).toBe('2026-09-30');
  });

  it('keeps lastDate when several returns share the newest date, newest created first among ties', async () => {
    const u = await createTestUser();
    const acc = await seedAccount(u);
    const first = await send(app, u, 'POST', '/investment-returns', { occurredOn: '2026-05-05', amount: '1.00', accountId: acc });
    const second = await send(app, u, 'POST', '/investment-returns', { occurredOn: '2026-05-05', amount: '2.00', accountId: acc });
    await send(app, u, 'POST', '/investment-returns', { occurredOn: '2026-04-04', amount: '3.00', accountId: acc });
    const { items, lastDate } = await list(u);
    expect(lastDate).toBe('2026-05-05');
    expect(items.map((r) => r.id).slice(0, 2)).toEqual([second.json<ReturnJson>().id, first.json<ReturnJson>().id]);
  });

  it('lists only the caller returns and answers 401 without a token', async () => {
    const mine = (await list(user)).items.map((r) => r.accountId);
    expect(mine).not.toContain(otherAccountId);
    const res = await app.inject({ method: 'GET', url: '/investment-returns' });
    expect(res.statusCode).toBe(401);
  });
});

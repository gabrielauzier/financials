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

interface SeedRow {
  name?: string;
  type?: 'Income' | 'Expense';
  occurredAt: string;
  amount?: string;
  accountId?: string;
  categoryId?: string;
  paymentMethod?: string;
  neutral?: boolean;
}

/** Inserts rows with admin SQL (as the owner) for volume; behavior is still exercised over HTTP. */
async function seed(owner: TestUser, defaultAccountId: string, rows: SeedRow[]): Promise<void> {
  const uncategorized = await categoryId(owner, 'Uncategorized');
  const sql = getAdminSql();
  await sql`
    insert into public.transactions
      (user_id, account_id, category_id, name, type, occurred_at, amount, payment_method, neutral)
    select ${owner.id}::uuid, r.account_id::uuid, r.category_id::uuid, r.name, r.type, r.occurred_at::timestamptz,
           r.amount::numeric, r.payment_method, r.neutral
    from jsonb_to_recordset(${sql.json(
      rows.map((r) => ({
        name: r.name ?? 'Linha',
        type: r.type ?? 'Expense',
        occurred_at: r.occurredAt,
        amount: r.amount ?? '10.00',
        account_id: r.accountId ?? defaultAccountId,
        category_id: r.categoryId ?? uncategorized,
        payment_method: r.paymentMethod ?? 'PIX',
        neutral: r.neutral ?? false,
      })),
    )}) as r(name text, type text, occurred_at text, amount text, account_id text, category_id text,
             payment_method text, neutral boolean)`;
}

interface Page {
  items: { id: string; name: string; occurredAt: string; amount: string; accountId: string; categoryName: string }[];
  total: number;
  page: number;
  pageSize: number;
}

async function list(as: TestUser, query = '', headers: Record<string, string> = {}): Promise<Page> {
  const res = await call(as, 'GET', `/transactions${query === '' ? '' : `?${query}`}`, undefined, headers);
  expect(res.statusCode).toBe(200);
  return res.json<Page>();
}

describe('GET /transactions', () => {
  let owner: TestUser;
  let ownerAccount: string;
  const hour = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString();

  beforeAll(async () => {
    owner = await createTestUser();
    ownerAccount = await createAccount(owner, 'Lista');
    // 120 rows; every 10th shares its instant with the previous one to force the id tie-break.
    await seed(
      owner,
      ownerAccount,
      Array.from({ length: 120 }, (_, i) => ({ name: `Linha ${i}`, occurredAt: hour(i % 10 === 0 ? i + 1 : i) })),
    );
  });

  it('returns page 1 with 50 items, total 120 and pageSize 50 by default', async () => {
    const body = await list(owner);
    expect(body).toMatchObject({ total: 120, page: 1, pageSize: 50 });
    expect(body.items).toHaveLength(50);
    expect(Object.keys(body.items[0] ?? {}).sort()).toEqual(
      [
        'id', 'accountId', 'accountNickname', 'categoryId', 'categoryName', 'name', 'type', 'occurredAt', 'amount',
        'paymentMethod', 'notes', 'receipt', 'neutral', 'counterpartyDocument', 'counterpartyBank',
      ].sort(),
    );
  });

  it('returns 20 items on page 3 and an empty page past the end, keeping the total', async () => {
    const third = await list(owner, 'page=3');
    expect(third).toMatchObject({ total: 120, page: 3 });
    expect(third.items).toHaveLength(20);
    const fourth = await list(owner, 'page=4');
    expect(fourth).toMatchObject({ total: 120, page: 4, items: [] });
  });

  it('orders by date descending, stable across pages (no duplicates or gaps with equal instants)', async () => {
    const all = [...(await list(owner, 'page=1')).items, ...(await list(owner, 'page=2')).items, ...(await list(owner, 'page=3')).items];
    expect(new Set(all.map((r) => r.id)).size).toBe(120);
    const sorted = [...all].sort((a, b) =>
      a.occurredAt === b.occurredAt ? (a.id < b.id ? 1 : -1) : a.occurredAt < b.occurredAt ? 1 : -1,
    );
    expect(all.map((r) => r.id)).toEqual(sorted.map((r) => r.id));
    expect(all[0]?.occurredAt).toBe(hour(119));
  });

  it("never returns another user's rows, nor counts them", async () => {
    const other = await createTestUser();
    const otherAccount = await createAccount(other, 'Outra');
    await seed(other, otherAccount, [{ name: 'Só da outra', occurredAt: hour(500) }]);

    const mine = await list(owner);
    expect(mine.total).toBe(120);
    expect(mine.items.map((r) => r.name)).not.toContain('Só da outra');
    const theirs = await list(other);
    expect(theirs).toMatchObject({ total: 1 });
    expect(theirs.items.map((r) => r.name)).toEqual(['Só da outra']);
  });

  it('returns an empty page with total 0 for a user without transactions', async () => {
    const fresh = await createTestUser();
    expect(await list(fresh)).toEqual({ items: [], total: 0, page: 1, pageSize: 50 });
  });

  it.each(['0', '-1', 'abc', '1.5', '', '1e2'])('rejects page=%j with 422 validation_error on field page', async (page) => {
    const res = await call(owner, 'GET', `/transactions?page=${encodeURIComponent(page)}`);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { code: 'validation_error', message: expect.any(String), field: 'page' } });
  });

  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/transactions' })).statusCode).toBe(401);
  });
});

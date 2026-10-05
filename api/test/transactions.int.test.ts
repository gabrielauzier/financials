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

describe('GET /transactions filters', () => {
  let u: TestUser;
  let acc1: string;
  let acc2: string;
  let food: string;
  let bills: string;

  beforeAll(async () => {
    u = await createTestUser();
    acc1 = await createAccount(u, 'Conta 1');
    acc2 = await createAccount(u, 'Conta 2');
    food = await categoryId(u, 'Food');
    bills = await categoryId(u, 'Bills');
    await seed(u, acc1, [
      { name: 'A1 food expense', occurredAt: '2026-05-10T12:00:00Z', accountId: acc1, categoryId: food, type: 'Expense', neutral: false },
      { name: 'A1 bills income', occurredAt: '2026-05-11T12:00:00Z', accountId: acc1, categoryId: bills, type: 'Income', neutral: false },
      { name: 'A2 food neutral', occurredAt: '2026-05-12T12:00:00Z', accountId: acc2, categoryId: food, type: 'Expense', neutral: true },
      { name: 'A2 bills neutral income', occurredAt: '2026-05-13T12:00:00Z', accountId: acc2, categoryId: bills, type: 'Income', neutral: true },
    ]);
  });

  const names = async (query: string) => (await list(u, query)).items.map((r) => r.name).sort();

  it('filters by account, by category and by type, each alone', async () => {
    expect(await names(`accountId=${acc1}`)).toEqual(['A1 bills income', 'A1 food expense']);
    expect(await names(`categoryId=${bills}`)).toEqual(['A1 bills income', 'A2 bills neutral income']);
    expect(await names('type=Income')).toEqual(['A1 bills income', 'A2 bills neutral income']);
    expect(await names('type=Expense')).toEqual(['A1 food expense', 'A2 food neutral']);
    expect((await list(u, `accountId=${acc2}`)).total).toBe(2);
  });

  it('filters neutral=true and neutral=false', async () => {
    expect(await names('neutral=true')).toEqual(['A2 bills neutral income', 'A2 food neutral']);
    expect(await names('neutral=false')).toEqual(['A1 bills income', 'A1 food expense']);
  });

  it('combines every filter with AND', async () => {
    expect(await names(`accountId=${acc2}&categoryId=${food}&type=Expense&neutral=true`)).toEqual(['A2 food neutral']);
    expect(await names(`accountId=${acc1}&neutral=true`)).toEqual([]);
    expect(await names(`categoryId=${food}&type=Income`)).toEqual([]);
    expect(await names('from=2026-05-11&to=2026-05-12&type=Expense')).toEqual(['A2 food neutral']);
    const combined = await list(u, `accountId=${acc2}&neutral=true`);
    expect(combined.total).toBe(2);
  });

  it('filters by period using whole local days, including both edges', async () => {
    expect(await names('from=2026-05-11&to=2026-05-12')).toEqual(['A1 bills income', 'A2 food neutral']);
    expect(await names('from=2026-05-12')).toEqual(['A2 bills neutral income', 'A2 food neutral']);
    expect(await names('to=2026-05-10')).toEqual(['A1 food expense']);
    expect(await names('from=2026-05-14')).toEqual([]);
  });

  it('rejects malformed filters with 422 validation_error naming the field', async () => {
    for (const [query, field] of [
      ['from=10/05/2026', 'from'],
      ['to=2026-13-01', 'to'],
      ['from=2026-02-30', 'from'],
      ['accountId=nope', 'accountId'],
      ['categoryId=nope', 'categoryId'],
      ['type=Transfer', 'type'],
      ['neutral=yes', 'neutral'],
    ] as const) {
      const res = await call(u, 'GET', `/transactions?${query}`);
      expect(res.statusCode, query).toBe(422);
      expect(res.json(), query).toMatchObject({ error: { code: 'validation_error', field } });
    }
  });
});

describe('GET /transactions period edges depend on X-Timezone', () => {
  let u: TestUser;
  const stamps = [
    '2026-03-09T14:59:59Z',
    '2026-03-09T15:00:00Z',
    '2026-03-10T02:59:59Z',
    '2026-03-10T03:00:00Z',
    '2026-03-10T14:59:59Z',
    '2026-03-10T15:00:00Z',
    '2026-03-11T02:59:59Z',
    '2026-03-11T03:00:00Z',
  ];

  beforeAll(async () => {
    u = await createTestUser();
    const a = await createAccount(u, 'Bordas');
    await seed(u, a, stamps.map((occurredAt) => ({ occurredAt })));
  });

  const instants = async (query: string, tz?: string) =>
    (await list(u, query, tz === undefined ? {} : { 'x-timezone': tz })).items.map((r) => r.occurredAt.replace('.000Z', 'Z')).sort();

  it('America/Sao_Paulo (UTC-3): 2026-03-10 spans 03:00Z of the day to 02:59:59Z of the next', async () => {
    expect(await instants('from=2026-03-10&to=2026-03-10', 'America/Sao_Paulo')).toEqual([
      '2026-03-10T03:00:00Z',
      '2026-03-10T14:59:59Z',
      '2026-03-10T15:00:00Z',
      '2026-03-11T02:59:59Z',
    ]);
  });

  it('uses America/Sao_Paulo when no X-Timezone is sent', async () => {
    expect(await instants('from=2026-03-10&to=2026-03-10')).toEqual(await instants('from=2026-03-10&to=2026-03-10', 'America/Sao_Paulo'));
  });

  it('Asia/Tokyo (UTC+9): 2026-03-10 spans 15:00Z of the previous day to 14:59:59Z', async () => {
    expect(await instants('from=2026-03-10&to=2026-03-10', 'Asia/Tokyo')).toEqual([
      '2026-03-09T15:00:00Z',
      '2026-03-10T02:59:59Z',
      '2026-03-10T03:00:00Z',
      '2026-03-10T14:59:59Z',
    ]);
  });

  it('UTC: 2026-03-10 is exactly the UTC day', async () => {
    expect(await instants('from=2026-03-10&to=2026-03-10', 'UTC')).toEqual([
      '2026-03-10T02:59:59Z',
      '2026-03-10T03:00:00Z',
      '2026-03-10T14:59:59Z',
      '2026-03-10T15:00:00Z',
    ]);
  });

  it('from alone starts at local midnight and to alone ends at the next local midnight (exclusive)', async () => {
    expect(await instants('from=2026-03-11', 'America/Sao_Paulo')).toEqual(['2026-03-11T03:00:00Z']);
    expect(await instants('to=2026-03-09', 'America/Sao_Paulo')).toEqual([
      '2026-03-09T14:59:59Z',
      '2026-03-09T15:00:00Z',
      '2026-03-10T02:59:59Z',
    ]);
  });

  it('rejects an invalid X-Timezone with 400', async () => {
    const res = await call(u, 'GET', '/transactions?from=2026-03-10', undefined, { 'x-timezone': 'Mars/Base' });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /transactions name search (q)', () => {
  let u: TestUser;

  beforeAll(async () => {
    u = await createTestUser();
    const a = await createAccount(u, 'Busca');
    await seed(u, a, [
      { name: 'Café Central', occurredAt: '2026-06-01T12:00:00Z', type: 'Expense' },
      { name: 'CAFE', occurredAt: '2026-06-02T12:00:00Z', type: 'Income' },
      { name: 'Padaria São João', occurredAt: '2026-06-03T12:00:00Z' },
      { name: 'Promo 100% off', occurredAt: '2026-06-04T12:00:00Z' },
      { name: 'Promo 1000 itens', occurredAt: '2026-06-05T12:00:00Z' },
      { name: 'snake_case', occurredAt: '2026-06-06T12:00:00Z' },
      { name: 'snakeXcase', occurredAt: '2026-06-07T12:00:00Z' },
      { name: 'caminho\\arquivo', occurredAt: '2026-06-08T12:00:00Z' },
    ]);
  });

  const names = async (q: string, extra = '') =>
    (await list(u, `q=${encodeURIComponent(q)}${extra}`)).items.map((r) => r.name).sort();

  it('matches "cafe" against "Café Central" and "CAFE" (ignoring case and accents)', async () => {
    expect(await names('cafe')).toEqual(['CAFE', 'Café Central']);
  });

  it('ignores accents and case in the typed text too, and matches inside the name', async () => {
    expect(await names('CAFÉ')).toEqual(['CAFE', 'Café Central']);
    expect(await names('sao joao')).toEqual(['Padaria São João']);
    expect(await names('central')).toEqual(['Café Central']);
  });

  it('returns an empty page with total 0 when nothing matches', async () => {
    const body = await list(u, 'q=inexistente');
    expect(body).toEqual({ items: [], total: 0, page: 1, pageSize: 50 });
  });

  it('treats %, _ and backslash in the text literally', async () => {
    expect(await names('100%')).toEqual(['Promo 100% off']);
    expect(await names('%')).toEqual(['Promo 100% off']);
    expect(await names('snake_')).toEqual(['snake_case']);
    expect(await names('_')).toEqual(['snake_case']);
    expect(await names('\\')).toEqual(['caminho\\arquivo']);
  });

  it('combines with the other filters and counts only matches; a blank q means no search', async () => {
    expect(await names('cafe', '&type=Income')).toEqual(['CAFE']);
    expect((await list(u, 'q=cafe')).total).toBe(2);
    expect((await list(u, `q=${encodeURIComponent('   ')}`)).total).toBe(8);
  });
});

describe('GET /transactions sorting', () => {
  let u: TestUser;
  const cents = (amount: string) => BigInt(amount.replace('.', ''));
  // Amounts whose text order differs from the numeric order ("100.00" < "9.00" as text).
  const AMOUNTS = ['9.00', '10.00', '100.00', '2.50', '1000.00', '0.99'];

  beforeAll(async () => {
    u = await createTestUser();
    const a = await createAccount(u, 'Ordem');
    const categories = [await categoryId(u, 'Food'), await categoryId(u, 'Bills'), await categoryId(u, 'Pets')];
    // 75 rows -> 2 pages. Names, amounts, categories and instants are all shuffled relative to each other.
    await seed(
      u,
      a,
      Array.from({ length: 75 }, (_, i) => ({
        name: `item ${String((i * 37) % 75).padStart(2, '0')}`,
        amount: AMOUNTS[(i * 5) % AMOUNTS.length],
        categoryId: categories[(i * 7) % 3],
        occurredAt: new Date(Date.UTC(2026, 6, 1) + ((i * 29) % 75) * 3_600_000).toISOString(),
      })),
    );
  });

  const both = async (query: string) => {
    const p1 = await list(u, `${query}&page=1`);
    const p2 = await list(u, `${query}&page=2`);
    expect(p1.items).toHaveLength(50);
    expect(p2.items).toHaveLength(25);
    return [...p1.items, ...p2.items];
  };

  /** Asserts the full set is ordered by `key` (then id, same direction) across both pages. */
  function expectOrdered(rows: Page['items'], key: (r: Page['items'][number]) => string | bigint, dir: 1 | -1) {
    for (let i = 1; i < rows.length; i++) {
      const [a, b] = [rows[i - 1], rows[i]] as [Page['items'][number], Page['items'][number]];
      const [ka, kb] = [key(a), key(b)];
      const cmp = ka < kb ? -1 : ka > kb ? 1 : a.id < b.id ? -1 : 1;
      expect(cmp * dir, `row ${i}`).toBeLessThan(0);
    }
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  }

  it('sorts the whole set by name ascending and descending, not only the page', async () => {
    expectOrdered(await both('sort=name&order=asc'), (r) => r.name, 1);
    const desc = await both('sort=name&order=desc');
    expectOrdered(desc, (r) => r.name, -1);
    expect(desc[0]?.name).toBe('item 74');
    expect(desc.at(-1)?.name).toBe('item 00');
  });

  it('sorts the whole set by amount numerically (100.00 above 9.00)', async () => {
    const asc = await both('sort=amount&order=asc');
    expectOrdered(asc, (r) => cents(r.amount), 1);
    expect(asc[0]?.amount).toBe('0.99');
    expect(asc.at(-1)?.amount).toBe('1000.00');
    expectOrdered(await both('sort=amount&order=desc'), (r) => cents(r.amount), -1);
  });

  it('sorts the whole set by category name in both directions', async () => {
    const asc = await both('sort=category&order=asc');
    expectOrdered(asc, (r) => r.categoryName, 1);
    expect(asc[0]?.categoryName).toBe('Alimentação');
    expect(asc.at(-1)?.categoryName).toBe('Pets');
    expectOrdered(await both('sort=category&order=desc'), (r) => r.categoryName, -1);
  });

  it('sorts the whole set by date in both directions, and defaults to date descending', async () => {
    expectOrdered(await both('sort=date&order=asc'), (r) => r.occurredAt, 1);
    expectOrdered(await both('sort=date&order=desc'), (r) => r.occurredAt, -1);
    expectOrdered(await both('sort=date'), (r) => r.occurredAt, -1);
    expect((await list(u)).items.map((r) => r.id)).toEqual((await list(u, 'sort=date&order=desc')).items.map((r) => r.id));
  });

  it('combines sorting with filters and the search', async () => {
    const rows = (await list(u, 'sort=amount&order=desc&q=item 1')).items;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.name.includes('item 1'))).toBe(true);
    expectOrdered(rows, (r) => cents(r.amount), -1);
  });

  it.each([
    ['sort=foo', 'sort'],
    ['sort=', 'sort'],
    ['sort=Name', 'sort'],
    ['order=up', 'order'],
    ['sort=name&order=', 'order'],
    ['order=ASC', 'order'],
  ])('rejects %s with 422 validation_error naming %s', async (query, field) => {
    const res = await call(u, 'GET', `/transactions?${query}`);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { code: 'validation_error', message: expect.any(String), field } });
  });
});

interface Txn {
  id: string;
  accountId: string;
  accountNickname: string;
  categoryId: string;
  categoryName: string;
  name: string;
  type: string;
  occurredAt: string;
  amount: string;
  paymentMethod: string;
  notes: string | null;
  receipt: string | null;
  neutral: boolean;
  counterpartyDocument: string | null;
  counterpartyBank: string | null;
}

describe('PATCH /transactions/:id', () => {
  let u: TestUser;
  let account: string;
  let food: string;

  beforeAll(async () => {
    u = await createTestUser();
    account = await createAccount(u, 'Edição');
    food = await categoryId(u, 'Food');
  });

  async function create(over: Record<string, unknown> = {}): Promise<Txn> {
    const res = await call(u, 'POST', '/transactions', {
      ...valid({ accountId: account, categoryId: food, notes: 'feira', receipt: 'https://example.com/r/1' }),
      ...over,
    });
    expect(res.statusCode).toBe(201);
    return res.json<Txn>();
  }

  const patch = (id: string, body: unknown, as: TestUser = u) => call(as, 'PATCH', `/transactions/${id}`, body);

  /** The row as the owner sees it in the list (persisted state, not the PATCH response). */
  async function stored(id: string): Promise<Txn | undefined> {
    return (await list(u, 'page=1')).items.find((r) => r.id === id) as Txn | undefined;
  }

  it('persists the edited fields and keeps every other field by value', async () => {
    const original = await create();
    const res = await patch(original.id, { amount: '99.9', name: '  Feira livre  ' });
    expect(res.statusCode).toBe(200);
    const expected = { ...original, amount: '99.90', name: 'Feira livre' };
    expect(res.json()).toEqual(expected);
    expect(await stored(original.id)).toEqual(expected);
  });

  it('edits each remaining editable field alone, preserving the rest', async () => {
    const original = await create();
    const bills = await categoryId(u, 'Bills');
    const second = await createAccount(u, 'Segunda');
    let expected: Txn = original;
    for (const [body, change] of [
      [{ type: 'Income' }, { type: 'Income' }],
      [{ occurredAt: '2026-01-02T00:30:00+09:00' }, { occurredAt: '2026-01-01T15:30:00.000Z' }],
      [{ paymentMethod: 'Cash' }, { paymentMethod: 'Cash' }],
      [{ notes: 'nova nota' }, { notes: 'nova nota' }],
      [{ receipt: 'http://example.com/novo' }, { receipt: 'http://example.com/novo' }],
      [{ categoryId: bills }, { categoryId: bills, categoryName: 'Contas' }],
      [{ accountId: second }, { accountId: second, accountNickname: 'Segunda' }],
      [{ notes: null, receipt: '  ' }, { notes: null, receipt: null }],
    ] as [Record<string, unknown>, Partial<Txn>][]) {
      expected = { ...expected, ...change };
      const res = await patch(original.id, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(200);
      expect(res.json(), JSON.stringify(body)).toEqual(expected);
    }
    expect(await stored(original.id)).toEqual(expected);
  });

  it('returns the current row unchanged for an empty body', async () => {
    const original = await create();
    const res = await patch(original.id, {});
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(original);
    expect(await stored(original.id)).toEqual(original);
  });

  it('toggles neutral on and off and persists each value', async () => {
    const original = await create();
    const on = await patch(original.id, { neutral: true });
    expect(on.statusCode).toBe(200);
    expect(on.json()).toEqual({ ...original, neutral: true });
    expect((await stored(original.id))?.neutral).toBe(true);
    const off = await patch(original.id, { neutral: false });
    expect(off.json()).toEqual(original);
    expect(await getAdminSql()`select neutral from public.transactions where id = ${original.id}`).toEqual([{ neutral: false }]);
  });

  it('applies the create validations to any field present and changes nothing on rejection', async () => {
    const original = await create();
    const other = await createTestUser();
    const foreignAccount = await createAccount(other, 'Alheia');
    const foreignCategory = await categoryId(other, 'Food');
    const cases: [Record<string, unknown>, number, Record<string, string>][] = [
      [{ amount: '0' }, 422, { code: 'invalid_amount', field: 'amount' }],
      [{ amount: '-1.00' }, 422, { code: 'invalid_amount', field: 'amount' }],
      [{ amount: '1.234' }, 422, { code: 'invalid_amount', field: 'amount' }],
      [{ amount: '1000000000000' }, 422, { code: 'invalid_amount', field: 'amount' }],
      [{ name: '   ' }, 422, { code: 'validation_error', field: 'name' }],
      [{ type: 'Transfer' }, 422, { code: 'validation_error', field: 'type' }],
      [{ occurredAt: '2026-10-05T14:30:00' }, 422, { code: 'validation_error', field: 'occurredAt' }],
      [{ paymentMethod: '' }, 422, { code: 'validation_error', field: 'paymentMethod' }],
      [{ receipt: 'javascript:alert(1)' }, 422, { code: 'invalid_receipt_url', field: 'receipt' }],
      [{ accountId: foreignAccount }, 422, { code: 'invalid_account', field: 'accountId' }],
      [{ accountId: '00000000-0000-4000-8000-000000000000' }, 422, { code: 'invalid_account', field: 'accountId' }],
      [{ accountId: 'nope' }, 422, { code: 'invalid_account', field: 'accountId' }],
      [{ categoryId: foreignCategory }, 404, { code: 'not_found', field: 'categoryId' }],
      [{ categoryId: '00000000-0000-4000-8000-000000000000' }, 404, { code: 'not_found', field: 'categoryId' }],
      // A valid field next to an invalid one is not applied either.
      [{ name: 'Mudou', amount: 'abc' }, 422, { code: 'invalid_amount', field: 'amount' }],
      [{ name: 'Mudou', categoryId: 'nope' }, 404, { code: 'not_found', field: 'categoryId' }],
    ];
    for (const [body, status, error] of cases) {
      const res = await patch(original.id, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(status);
      expect(res.json(), JSON.stringify(body)).toEqual({ error: { ...error, message: expect.any(String) } });
    }
    expect(await stored(original.id)).toEqual(original);
  });

  it("returns 404 for an unknown, malformed or another user's id, leaving that row untouched", async () => {
    const original = await create();
    for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const res = await patch(id, { name: 'X' });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: { code: 'not_found' } });
    }
    const intruder = await createTestUser();
    const res = await patch(original.id, { name: 'Invadido', neutral: true }, intruder);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'not_found' } });
    expect(await stored(original.id)).toEqual(original);
  });

  it("edits a transaction of an inactive account, and moves a row to an inactive account (only creation is blocked)", async () => {
    const closing = await createAccount(u, 'Encerrada');
    const original = await create({ accountId: closing });
    expect((await call(u, 'POST', `/accounts/${closing}/deactivate`)).statusCode).toBe(200);

    const edited = await patch(original.id, { amount: '5.00', neutral: true });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toEqual({ ...original, amount: '5.00', neutral: true });

    const other = await create();
    const moved = await patch(other.id, { accountId: closing });
    expect(moved.statusCode).toBe(200);
    expect(moved.json()).toEqual({ ...other, accountId: closing, accountNickname: 'Encerrada' });
  });

  it('requires authentication', async () => {
    const original = await create();
    const res = await app.inject({ method: 'PATCH', url: `/transactions/${original.id}`, payload: { name: 'X' } });
    expect(res.statusCode).toBe(401);
    expect(await stored(original.id)).toEqual(original);
  });
});

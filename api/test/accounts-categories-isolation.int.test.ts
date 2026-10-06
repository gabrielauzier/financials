import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, type TestUser } from './helpers/db.js';
import { getLocalStack } from './helpers/stack.js';

let app: FastifyInstance;
let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  const { apiUrl, dbUrl } = getLocalStack();
  app = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl });
  await app.ready();
  a = await createTestUser();
  b = await createTestUser();
});

afterAll(async () => {
  await app.close();
  await cleanupTestUsers();
  await closeAdminSql();
});

function call(as: TestUser, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${as.token}` }, payload: payload as object });
}

interface Category {
  id: string;
  key: string | null;
  name: string;
  isSystem: boolean;
}

async function listAccounts(as: TestUser): Promise<unknown[]> {
  const res = await call(as, 'GET', '/accounts');
  expect(res.statusCode).toBe(200);
  return res.json<unknown[]>();
}

async function listCategories(as: TestUser): Promise<Category[]> {
  const res = await call(as, 'GET', '/categories');
  expect(res.statusCode).toBe(200);
  return res.json<Category[]>();
}

const ids = (rows: unknown[]) => (rows as { id: string }[]).map((r) => r.id);

describe("isolation between users' accounts and categories (AUTH-08)", () => {
  it("answers 404 to every route user B calls on user A's accounts and categories, changing nothing", async () => {
    const accountA = (
      await call(a, 'POST', '/accounts', { bank: 'Nubank', nickname: 'Conta da A', holderNames: ['Ana'] })
    ).json<{ id: string }>();
    const ownCategoryA = (await call(a, 'POST', '/categories', { name: 'Só da A' })).json<Category>();
    const categoriesA = await listCategories(a);
    const regularA = categoriesA.find((c) => c.key === 'Food') as Category;
    const systemA = categoriesA.find((c) => c.key === 'Reversal') as Category;
    const accountsBefore = await listAccounts(a);
    const destinationB = (await listCategories(b)).find((c) => c.key === 'Food') as Category;

    const attempts: [method: 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown][] = [
      ['PATCH', `/accounts/${accountA.id}`, { nickname: 'Hacked' }],
      ['POST', `/accounts/${accountA.id}/deactivate`],
      ['POST', `/accounts/${accountA.id}/activate`],
    ];
    for (const category of [ownCategoryA, regularA, systemA]) {
      attempts.push(
        ['PATCH', `/categories/${category.id}`, { name: 'Hacked' }],
        ['DELETE', `/categories/${category.id}`],
        ['DELETE', `/categories/${category.id}?reassignTo=${destinationB.id}`],
      );
    }
    for (const [method, url, payload] of attempts) {
      const res = await call(b, method, url, payload);
      expect({ method, url, status: res.statusCode }).toEqual({ method, url, status: 404 });
      expect(res.json()).toMatchObject({ error: { code: 'not_found' } });
    }

    // B cannot use A's category as the destination of B's own delete.
    const victimB = (await listCategories(b)).find((c) => c.key === 'Pets') as Category;
    const reassign = await call(b, 'DELETE', `/categories/${victimB.id}?reassignTo=${ownCategoryA.id}`);
    expect(reassign.statusCode).toBe(404);
    expect(reassign.json()).toMatchObject({ error: { code: 'not_found' } });
    expect(ids(await listCategories(b))).toContain(victimB.id);

    // A's data is exactly as before.
    expect(await listAccounts(a)).toEqual(accountsBefore);
    expect(accountsBefore).toEqual([expect.objectContaining({ id: accountA.id, nickname: 'Conta da A', active: true })]);
    expect(await listCategories(a)).toEqual(categoriesA);
  });

  it("never shows user A's accounts or categories in user B's lists", async () => {
    await call(a, 'POST', '/accounts', { bank: 'XP', nickname: 'Outra da A', holderNames: ['Ana'] });
    await call(a, 'POST', '/categories', { name: 'Outra só da A' });
    const accountB = (
      await call(b, 'POST', '/accounts', { bank: 'Neon', nickname: 'Conta da B', holderNames: ['Bia'] })
    ).json<{ id: string }>();
    const accountIdsA = ids(await listAccounts(a));
    const categoryIdsA = ids(await listCategories(a));
    expect(accountIdsA.length).toBeGreaterThan(0);

    const accountsB = await listAccounts(b);
    const categoriesB = await listCategories(b);
    expect(ids(accountsB)).toEqual([accountB.id]);
    expect(ids(accountsB).filter((id) => accountIdsA.includes(id))).toEqual([]);
    expect(ids(categoriesB).filter((id) => categoryIdsA.includes(id))).toEqual([]);
    expect(categoriesB.map((c) => c.name)).not.toContain('Outra só da A');
  });
});

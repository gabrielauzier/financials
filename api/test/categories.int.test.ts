import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { registerCategoryReference } from '../src/modules/categories/registry.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';
import { getLocalStack } from './helpers/stack.js';

let app: FastifyInstance;

beforeAll(async () => {
  const { apiUrl, dbUrl } = getLocalStack();
  app = buildApp({ supabaseUrl: apiUrl, databaseUrl: dbUrl });
  await app.ready();
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
  color: string;
}

async function list(as: TestUser): Promise<Category[]> {
  const res = await call(as, 'GET', '/categories');
  expect(res.statusCode).toBe(200);
  return res.json<Category[]>();
}

// The design table "Tabela de cores semeadas".
const SEEDED_COLORS: Record<string, string> = {
  Entertainment: 'purple-600',
  Food: 'orange-600',
  Salaries: 'emerald-600',
  Healthcare: 'rose-600',
  Utilities: 'sky-600',
  Unknown: 'zinc-400',
  Transport: 'blue-600',
  Help: 'pink-600',
  PJ: 'indigo-600',
  Bills: 'amber-600',
  Emergency: 'red-600',
  Uncategorized: 'slate-400',
  Wishes: 'fuchsia-600',
  Reversal: 'teal-600',
  Shopping: 'lime-600',
  Pets: 'yellow-600',
  Investments: 'green-900',
};

// Spec CAT-01 keys and pt-BR names; the spec defines no order, the API sorts by name (case-insensitive).
const SEEDED_BY_NAME: [key: string, name: string, isSystem: boolean][] = [
  ['Help', 'Ajuda (a terceiros)', false],
  ['Food', 'Alimentação', false],
  ['Shopping', 'Compras', false],
  ['Bills', 'Contas', false],
  ['Unknown', 'Desconhecida', false],
  ['Wishes', 'Desejos', false],
  ['Emergency', 'Emergência', false],
  ['Entertainment', 'Entretenimento', false],
  ['Reversal', 'Estorno (de compras)', true],
  ['Investments', 'Investimentos', true],
  ['Pets', 'Pets', false],
  ['PJ', 'PJ', false],
  ['Salaries', 'Salários', false],
  ['Healthcare', 'Saúde', false],
  ['Uncategorized', 'Sem categoria', true],
  ['Transport', 'Transporte', false],
  ['Utilities', 'Utilidades', false],
];

describe('GET /categories', () => {
  it('returns the 17 seeded categories of a new user with pt-BR names, sorted by name', async () => {
    const user = await createTestUser();
    const body = await list(user);

    expect(body).toHaveLength(17);
    expect(body.map((c) => [c.key, c.name, c.isSystem])).toEqual(SEEDED_BY_NAME);
    for (const category of body) {
      expect(category).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        key: expect.any(String),
        name: expect.any(String),
        isSystem: expect.any(Boolean),
        color: expect.any(String),
      });
    }
  });

  it("never returns another user's categories", async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const idsA = (await list(a)).map((c) => c.id);
    const idsB = (await list(b)).map((c) => c.id);

    expect(idsA).toHaveLength(17);
    expect(idsB).toHaveLength(17);
    expect(idsA.filter((id) => idsB.includes(id))).toEqual([]);
  });
});

describe('POST /categories', () => {
  it('creates a trimmed, non-system category with no key, ignoring client-sent key and isSystem', async () => {
    const user = await createTestUser();
    const res = await call(user, 'POST', '/categories', { name: '  Mercado  ', key: 'Reversal', isSystem: true });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      key: null,
      name: 'Mercado',
      isSystem: false,
      color: 'slate-600',
    });

    const rows = await getAdminSql()`
      select user_id, key, name, is_system from public.categories where id = ${res.json<Category>().id}`;
    expect(rows).toEqual([{ user_id: user.id, key: null, name: 'Mercado', is_system: false }]);
    expect((await list(user)).map((c) => c.name)).toContain('Mercado');
  });

  it('returns 422 validation_error on name for a blank or whitespace-only name, creating nothing', async () => {
    const user = await createTestUser();
    for (const name of ['', '   ']) {
      const res = await call(user, 'POST', '/categories', { name });
      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({ error: { code: 'validation_error', message: expect.any(String), field: 'name' } });
    }
    expect(await list(user)).toHaveLength(17);
  });

  it('returns 409 duplicate_name on name for an existing name in any case, but allows it for another user', async () => {
    const user = await createTestUser();
    expect((await call(user, 'POST', '/categories', { name: 'Viagem' })).statusCode).toBe(201);
    for (const name of ['VIAGEM', '  viagem ', 'ALIMENTAÇÃO']) {
      const res = await call(user, 'POST', '/categories', { name });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: { code: 'duplicate_name', message: expect.any(String), field: 'name' } });
    }
    expect(await list(user)).toHaveLength(18);

    const other = await createTestUser();
    expect((await call(other, 'POST', '/categories', { name: 'Viagem' })).statusCode).toBe(201);
  });
});

async function byKey(as: TestUser, key: string): Promise<Category> {
  const found = (await list(as)).find((c) => c.key === key);
  if (!found) throw new Error(`category ${key} not found`);
  return found;
}

describe('PATCH /categories/:id', () => {
  it('renames a regular category, keeps its key and allows a case-only change of its own name', async () => {
    const user = await createTestUser();
    const food = await byKey(user, 'Food');

    const res = await call(user, 'PATCH', `/categories/${food.id}`, { name: '  Mercado ', key: 'Other', isSystem: true });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: food.id,
      key: 'Food',
      name: 'Mercado',
      isSystem: false,
      color: 'orange-600',
    });
    expect(await getAdminSql()`select key, name, is_system from public.categories where id = ${food.id}`).toEqual([
      { key: 'Food', name: 'Mercado', is_system: false },
    ]);

    const own = await call(user, 'PATCH', `/categories/${food.id}`, { name: 'MERCADO' });
    expect(own.statusCode).toBe(200);
    expect(own.json()).toMatchObject({ key: 'Food', name: 'MERCADO' });
  });

  it('returns 403 category_protected when renaming Estorno, Sem categoria or Investimentos, changing nothing', async () => {
    const user = await createTestUser();
    for (const [key, name] of [
      ['Reversal', 'Estorno (de compras)'],
      ['Uncategorized', 'Sem categoria'],
      ['Investments', 'Investimentos'],
    ] as const) {
      const category = await byKey(user, key);
      const res = await call(user, 'PATCH', `/categories/${category.id}`, { name: 'Renomeada' });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: { code: 'category_protected', message: expect.any(String) } });
      expect(await byKey(user, key)).toEqual({ id: category.id, key, name, isSystem: true, color: SEEDED_COLORS[key] });
    }
  });

  it('rejects a duplicate name in any case with 409 and a blank name with 422, changing nothing', async () => {
    const user = await createTestUser();
    const pets = await byKey(user, 'Pets');
    const patch = (name: string) => call(user, 'PATCH', `/categories/${pets.id}`, { name });

    for (const name of ['compras', ' SEM CATEGORIA ']) {
      const dup = await patch(name);
      expect(dup.statusCode).toBe(409);
      expect(dup.json()).toEqual({ error: { code: 'duplicate_name', message: expect.any(String), field: 'name' } });
    }
    for (const name of ['', '   ']) {
      const blank = await patch(name);
      expect(blank.statusCode).toBe(422);
      expect(blank.json()).toEqual({ error: { code: 'validation_error', message: expect.any(String), field: 'name' } });
    }
    expect(await byKey(user, 'Pets')).toEqual({
      id: pets.id,
      key: 'Pets',
      name: 'Pets',
      isSystem: false,
      color: 'yellow-600',
    });
  });

  it("returns 404 for an unknown, malformed or another user's id, leaving the category untouched", async () => {
    const owner = await createTestUser();
    const intruder = await createTestUser();
    const food = await byKey(owner, 'Food');

    for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const res = await call(owner, 'PATCH', `/categories/${id}`, { name: 'X' });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: { code: 'not_found' } });
    }
    expect((await call(intruder, 'PATCH', `/categories/${food.id}`, { name: 'Hacked' })).statusCode).toBe(404);
    const reversal = await byKey(owner, 'Reversal');
    expect((await call(intruder, 'PATCH', `/categories/${reversal.id}`, { name: 'Hacked' })).statusCode).toBe(404);
    expect(await getAdminSql()`select name from public.categories where id in (${food.id}, ${reversal.id}) order by name`).toEqual([
      { name: 'Alimentação' },
      { name: 'Estorno (de compras)' },
    ]);
  });
});

/**
 * Temporary referencing tables shaped like real data tables (user_id, composite FK to categories
 * with on delete restrict, RLS). Registered only in this file; dropped in afterAll.
 */
const PROBE = 'public.category_ref_probe';
const FAILING = 'public.category_ref_probe_failing';

async function createProbeTable(name: string): Promise<void> {
  const sql = getAdminSql();
  await sql`drop table if exists ${sql(name)}`;
  await sql`
    create table ${sql(name)} (
      id bigint generated always as identity primary key,
      user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
      category_id uuid not null,
      foreign key (category_id, user_id) references public.categories (id, user_id) on delete restrict
    )`;
  await sql`alter table ${sql(name)} enable row level security`;
  await sql`
    create policy probe_all on ${sql(name)} for all to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))`;
  await sql`grant select, insert, update, delete on ${sql(name)} to authenticated`;
}

async function insertRefs(table: string, user: TestUser, categoryId: string, count: number): Promise<void> {
  const sql = getAdminSql();
  for (let i = 0; i < count; i += 1) {
    await sql`insert into ${sql(table)} (user_id, category_id) values (${user.id}, ${categoryId})`;
  }
}

async function refsOf(table: string, user: TestUser): Promise<string[]> {
  const sql = getAdminSql();
  const rows = await sql<{ category_id: string }[]>`
    select category_id from ${sql(table)} where user_id = ${user.id} order by id`;
  return rows.map((r) => r.category_id);
}

async function categoryExists(id: string): Promise<boolean> {
  return (await getAdminSql()`select 1 from public.categories where id = ${id}`).length === 1;
}

describe('DELETE /categories/:id', () => {
  let unregisterProbe: () => void;

  beforeAll(async () => {
    await createProbeTable(PROBE);
    await createProbeTable(FAILING);
    const sql = getAdminSql();
    await sql`
      create or replace function public.category_ref_probe_fail() returns trigger
      language plpgsql as $$ begin raise exception 'reassignment failure probe'; end $$`;
    await sql`
      create trigger category_ref_probe_fail before update on ${sql(FAILING)}
      for each row execute function public.category_ref_probe_fail()`;
    unregisterProbe = registerCategoryReference({ table: PROBE, column: 'category_id' });
  });

  afterAll(async () => {
    unregisterProbe();
    const sql = getAdminSql();
    await sql`drop table if exists ${sql(PROBE)}`;
    await sql`drop table if exists ${sql(FAILING)}`;
    await sql`drop function if exists public.category_ref_probe_fail()`;
  });

  it('deletes an unused regular category (204)', async () => {
    const user = await createTestUser();
    const pets = await byKey(user, 'Pets');
    await insertRefs(PROBE, user, (await byKey(user, 'Food')).id, 1); // another category is in use

    const res = await call(user, 'DELETE', `/categories/${pets.id}`);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(await categoryExists(pets.id)).toBe(false);
    expect((await list(user)).map((c) => c.id)).not.toContain(pets.id);
    expect(await list(user)).toHaveLength(16);
  });

  it('returns 403 category_protected for each system category, with or without reassignTo', async () => {
    const user = await createTestUser();
    const food = await byKey(user, 'Food');
    for (const key of ['Reversal', 'Uncategorized', 'Investments']) {
      const category = await byKey(user, key);
      await insertRefs(PROBE, user, category.id, 1);
      for (const url of [`/categories/${category.id}`, `/categories/${category.id}?reassignTo=${food.id}`]) {
        const res = await call(user, 'DELETE', url);
        expect(res.statusCode).toBe(403);
        expect(res.json()).toEqual({ error: { code: 'category_protected', message: expect.any(String) } });
      }
      expect(await categoryExists(category.id)).toBe(true);
    }
    const systemIds = (await list(user)).filter((c) => c.isSystem).map((c) => c.id);
    expect((await refsOf(PROBE, user)).sort()).toEqual(systemIds.sort());
  });

  it('returns 422 reassign_required for an in-use category without reassignTo, keeping it and its rows', async () => {
    const user = await createTestUser();
    const wishes = await byKey(user, 'Wishes');
    await insertRefs(PROBE, user, wishes.id, 2);

    const res = await call(user, 'DELETE', `/categories/${wishes.id}`);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { code: 'reassign_required', message: expect.any(String), field: 'reassignTo' } });
    expect(await categoryExists(wishes.id)).toBe(true);
    expect(await refsOf(PROBE, user)).toEqual([wishes.id, wishes.id]);
  });

  it('validates reassignTo and the id: 422 when equal to the category or malformed, 404 when unknown or foreign', async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    const bills = await byKey(user, 'Bills');
    await insertRefs(PROBE, user, bills.id, 1);
    const del = (url: string) => call(user, 'DELETE', url);

    for (const reassignTo of [bills.id, bills.id.toUpperCase(), 'not-a-uuid']) {
      const res = await del(`/categories/${bills.id}?reassignTo=${reassignTo}`);
      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({ error: { code: 'validation_error', message: expect.any(String), field: 'reassignTo' } });
    }
    const foreignDestination = await byKey(other, 'Food');
    for (const reassignTo of ['00000000-0000-4000-8000-000000000000', foreignDestination.id]) {
      const res = await del(`/categories/${bills.id}?reassignTo=${reassignTo}`);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: { code: 'not_found' } });
    }
    for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const res = await del(`/categories/${id}`);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: { code: 'not_found' } });
    }
    expect(await categoryExists(bills.id)).toBe(true);
    expect(await categoryExists(foreignDestination.id)).toBe(true);
    expect(await refsOf(PROBE, user)).toEqual([bills.id]);
  });

  it('leaves the category and every row unchanged when the reassignment fails midway', async () => {
    const user = await createTestUser();
    const help = await byKey(user, 'Help');
    const food = await byKey(user, 'Food');
    await insertRefs(PROBE, user, help.id, 2);
    await insertRefs(FAILING, user, help.id, 1);

    // The probe table is updated first; the failing table then raises inside the same transaction.
    const unregisterFailing = registerCategoryReference({ table: FAILING, column: 'category_id' });
    try {
      const res = await call(user, 'DELETE', `/categories/${help.id}?reassignTo=${food.id}`);
      expect(res.statusCode).toBe(500);
    } finally {
      unregisterFailing();
    }
    expect(await categoryExists(help.id)).toBe(true);
    expect(await refsOf(PROBE, user)).toEqual([help.id, help.id]);
    expect(await refsOf(FAILING, user)).toEqual([help.id]);
  });

  it('moves every registered row to reassignTo and deletes the category in one operation', async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    const transport = await byKey(user, 'Transport');
    const uncategorized = await byKey(user, 'Uncategorized');
    const keep = await byKey(user, 'Food');
    await insertRefs(PROBE, user, transport.id, 2);
    await insertRefs(PROBE, user, keep.id, 1);
    const othersTransport = await byKey(other, 'Transport');
    await insertRefs(PROBE, other, othersTransport.id, 1);

    // A system category is a valid destination.
    const res = await call(user, 'DELETE', `/categories/${transport.id}?reassignTo=${uncategorized.id}`);
    expect(res.statusCode).toBe(204);
    expect(await categoryExists(transport.id)).toBe(false);
    expect(await refsOf(PROBE, user)).toEqual([uncategorized.id, uncategorized.id, keep.id]);
    expect(await refsOf(PROBE, other)).toEqual([othersTransport.id]);
  });
});

const INVALID_STRING_COLORS = ['', 'blue', 'blue-500', 'Blue-600', ' blue-600', '#2563eb'];
const WRONG_TYPE_COLORS: unknown[] = [null, 5, { key: 'blue-600' }];

describe('category color', () => {
  it('returns the design color of each of the 17 seeded categories, all distinct', async () => {
    const user = await createTestUser();
    const body = await list(user);
    expect(Object.fromEntries(body.map((c) => [c.key, c.color]))).toEqual(SEEDED_COLORS);
    expect(new Set(body.map((c) => c.color)).size).toBe(17);
  });

  it('POST creates with the chosen color, or slate-600 when it is omitted', async () => {
    const user = await createTestUser();
    const chosen = await call(user, 'POST', '/categories', { name: 'Viagens', color: 'rose-900' });
    expect(chosen.statusCode).toBe(201);
    expect(chosen.json()).toMatchObject({ name: 'Viagens', color: 'rose-900' });
    const omitted = await call(user, 'POST', '/categories', { name: 'Sem cor' });
    expect(omitted.statusCode).toBe(201);
    expect(omitted.json()).toMatchObject({ color: 'slate-600' });
    expect(
      await getAdminSql()`select name, color from public.categories where user_id = ${user.id} and key is null order by name`,
    ).toEqual([
      { name: 'Sem cor', color: 'slate-600' },
      { name: 'Viagens', color: 'rose-900' },
    ]);
  });

  it.each(INVALID_STRING_COLORS)('POST rejects the color %j with 422 on field color and creates nothing', async (color) => {
    const user = await createTestUser();
    const res = await call(user, 'POST', '/categories', { name: 'Inválida', color });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { code: 'validation_error', message: expect.any(String), field: 'color' } });
    expect(await list(user)).toHaveLength(17);
  });

  it('answers 400 validation_error on field color for a color that is not a string, creating or changing nothing', async () => {
    const user = await createTestUser();
    const food = await byKey(user, 'Food');
    for (const color of WRONG_TYPE_COLORS) {
      const post = await call(user, 'POST', '/categories', { name: 'Tipo errado', color });
      expect({ color, status: post.statusCode }).toEqual({ color, status: 400 });
      expect(post.json()).toMatchObject({ error: { code: 'validation_error', field: 'color' } });
      const patch = await call(user, 'PATCH', `/categories/${food.id}`, { color });
      expect({ color, status: patch.statusCode }).toEqual({ color, status: 400 });
      expect(patch.json()).toMatchObject({ error: { code: 'validation_error', field: 'color' } });
    }
    expect(await list(user)).toHaveLength(17);
    expect((await byKey(user, 'Food')).color).toBe('orange-600');
  });

  it('PATCH with only color changes the color and keeps the name', async () => {
    const user = await createTestUser();
    const food = await byKey(user, 'Food');
    const res = await call(user, 'PATCH', `/categories/${food.id}`, { color: 'cyan-400' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: food.id, key: 'Food', name: 'Alimentação', isSystem: false, color: 'cyan-400' });
    expect(await getAdminSql()`select name, color from public.categories where id = ${food.id}`).toEqual([
      { name: 'Alimentação', color: 'cyan-400' },
    ]);
  });

  it('PATCH with name and color changes both', async () => {
    const user = await createTestUser();
    const pets = await byKey(user, 'Pets');
    const res = await call(user, 'PATCH', `/categories/${pets.id}`, { name: '  Bichos ', color: 'stone-900' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ key: 'Pets', name: 'Bichos', color: 'stone-900' });
    expect(await getAdminSql()`select name, color from public.categories where id = ${pets.id}`).toEqual([
      { name: 'Bichos', color: 'stone-900' },
    ]);
  });

  it('PATCH with a valid color and a conflicting name answers 409 and leaves the color unchanged', async () => {
    const user = await createTestUser();
    const pets = await byKey(user, 'Pets');
    const res = await call(user, 'PATCH', `/categories/${pets.id}`, { name: 'compras', color: 'red-400' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: { code: 'duplicate_name', message: expect.any(String), field: 'name' } });
    expect(await getAdminSql()`select name, color from public.categories where id = ${pets.id}`).toEqual([
      { name: 'Pets', color: 'yellow-600' },
    ]);
  });

  it('PATCH with a valid name and an invalid color answers 422 on field color and leaves the name unchanged', async () => {
    const user = await createTestUser();
    const pets = await byKey(user, 'Pets');
    for (const color of INVALID_STRING_COLORS) {
      const res = await call(user, 'PATCH', `/categories/${pets.id}`, { name: 'Bichos', color });
      expect({ color, status: res.statusCode }).toEqual({ color, status: 422 });
      expect(res.json()).toEqual({ error: { code: 'validation_error', message: expect.any(String), field: 'color' } });
    }
    expect(await getAdminSql()`select name, color from public.categories where id = ${pets.id}`).toEqual([
      { name: 'Pets', color: 'yellow-600' },
    ]);
  });

  it('PATCH with an empty body answers 200 with the category unchanged', async () => {
    const user = await createTestUser();
    const food = await byKey(user, 'Food');
    const res = await call(user, 'PATCH', `/categories/${food.id}`, {});
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(food);
    expect(await byKey(user, 'Food')).toEqual(food);
  });

  it('PATCH keeps a blank name as 422 on field name', async () => {
    const user = await createTestUser();
    const food = await byKey(user, 'Food');
    for (const body of [{ name: '' }, { name: '   ', color: 'red-400' }]) {
      const res = await call(user, 'PATCH', `/categories/${food.id}`, body);
      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({ error: { code: 'validation_error', message: expect.any(String), field: 'name' } });
    }
    expect(await byKey(user, 'Food')).toEqual(food);
  });

  it('PATCH of a system category with a name or a color answers 403 category_protected and the color stays', async () => {
    const user = await createTestUser();
    const uncategorized = await byKey(user, 'Uncategorized');
    for (const body of [{ name: 'Outra' }, { color: 'red-400' }, { name: 'Outra', color: 'red-400' }]) {
      const res = await call(user, 'PATCH', `/categories/${uncategorized.id}`, body);
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: { code: 'category_protected', message: expect.any(String) } });
    }
    expect(await byKey(user, 'Uncategorized')).toEqual(uncategorized);
    expect(uncategorized.color).toBe('slate-400');
  });

  it("PATCH of another user's category answers 404 not_found and leaves its color unchanged", async () => {
    const owner = await createTestUser();
    const intruder = await createTestUser();
    const food = await byKey(owner, 'Food');
    const res = await call(intruder, 'PATCH', `/categories/${food.id}`, { color: 'red-400' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'not_found' } });
    expect((await byKey(owner, 'Food')).color).toBe('orange-600');
  });
});

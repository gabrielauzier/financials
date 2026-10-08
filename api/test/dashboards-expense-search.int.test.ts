import type { FastifyInstance } from 'fastify';
import { DateTime } from 'luxon';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, closeAdminSql, createTestUser, type TestUser } from './helpers/db.js';
import { get, seedAccount, seedTransactions, startApp, type TxSeed } from './helpers/dashboards.js';

let app: FastifyInstance;
const SP = 'America/Sao_Paulo';

beforeAll(async () => {
  app = await startApp();
});

afterAll(async () => {
  await app.close();
  await cleanupTestUsers();
  await closeAdminSql();
});

async function fresh(rows: TxSeed[] = []) {
  const user = await createTestUser();
  const accountId = await seedAccount(user);
  await seedTransactions(user, accountId, rows);
  return user;
}

interface Search {
  points: { month: string; total: string }[];
  total: string;
  count: number;
}

const search = async (user: TestUser, q: string, headers: Record<string, string> = {}) => {
  const res = await get(app, user, `/dashboard/expense-search?q=${encodeURIComponent(q)}`, headers);
  expect(res.statusCode).toBe(200);
  return res.json<Search>();
};

/** Day 10, 12:00 local, `back` months before the current month (always in the past for back >= 1). */
const back = (n: number, zone = SP) =>
  DateTime.now().setZone(zone).startOf('month').minus({ months: n }).set({ day: 10, hour: 12 });
const monthKey = (n: number, zone = SP) => back(n, zone).toFormat('yyyy-MM');
const iso = (n: number) => back(n).toISO() as string;

describe('GET /dashboard/expense-search', () => {
  it('matches the name or the description, adds the totals per month and counts the transactions', async () => {
    const user = await fresh([
      { type: 'Expense', amount: '39.90', at: iso(3), name: 'Netflix' },
      { type: 'Expense', amount: '39.90', at: iso(2), name: 'Assinatura', description: 'PAGTO NETFLIX.COM' },
      { type: 'Expense', amount: '10.00', at: iso(2), name: 'Netflix extra' },
      { type: 'Expense', amount: '55.00', at: iso(1), name: 'Mercado' },
    ]);
    const body = await search(user, 'netflix', { 'x-timezone': SP });
    expect(body.points).toEqual([
      { month: monthKey(3), total: '39.90' },
      { month: monthKey(2), total: '49.90' },
      { month: monthKey(1), total: '0.00' },
      { month: monthKey(0), total: '0.00' },
    ]);
    expect(body.total).toBe('89.80');
    expect(body.count).toBe(3);
  });

  it('ignores case and accents in the text, the name and the description', async () => {
    const user = await fresh([
      { type: 'Expense', amount: '10.00', at: iso(2), name: 'Padaria São João' },
      { type: 'Expense', amount: '20.00', at: iso(2), name: 'Outra', description: 'CAFÉ DA MANHÃ' },
      { type: 'Expense', amount: '30.00', at: iso(2), name: 'AÇAÍ do Zé' },
      { type: 'Expense', amount: '5.00', at: iso(2), name: 'Sem relacao' },
    ]);
    expect((await search(user, 'sao joao')).count).toBe(1);
    expect((await search(user, 'SÃO JOÃO')).count).toBe(1);
    expect((await search(user, 'cafe da manha')).total).toBe('20.00');
    expect((await search(user, 'café')).count).toBe(1);
    expect((await search(user, 'acai')).total).toBe('30.00');
    expect((await search(user, 'açaí')).count).toBe(1);
    expect((await search(user, 'ZE')).count).toBe(1);
    expect((await search(user, 'a')).count).toBe(4);
  });

  it('trims the text before searching', async () => {
    const user = await fresh([{ type: 'Expense', amount: '10.00', at: iso(1), name: 'Farmácia' }]);
    expect((await search(user, '   farmacia  ')).count).toBe(1);
  });

  it('matches %, _ and \\ literally, never as wildcards', async () => {
    const user = await fresh([
      { type: 'Expense', amount: '1.00', at: iso(1), name: 'Desconto 50% off' },
      { type: 'Expense', amount: '2.00', at: iso(1), name: 'Taxa_fixa' },
      { type: 'Expense', amount: '4.00', at: iso(1), name: 'Pasta C:\\temp' },
      { type: 'Expense', amount: '8.00', at: iso(1), name: 'Desconto 50 por cento' },
      { type: 'Expense', amount: '16.00', at: iso(1), name: 'Taxa fixa' },
    ]);
    expect(await search(user, '%')).toMatchObject({ count: 1, total: '1.00' });
    expect(await search(user, '50%')).toMatchObject({ count: 1, total: '1.00' });
    expect(await search(user, '_')).toMatchObject({ count: 1, total: '2.00' });
    expect(await search(user, 'a_f')).toMatchObject({ count: 1, total: '2.00' });
    expect(await search(user, '\\')).toMatchObject({ count: 1, total: '4.00' });
    expect(await search(user, 'c:\\t')).toMatchObject({ count: 1, total: '4.00' });
    // a wildcard does not span characters: "50%off" has no match, neither does "Taxa_fixa" for "Taxa fixa"
    expect((await search(user, 'desconto%off')).count).toBe(0);
    expect((await search(user, 'taxa_fixa')).count).toBe(1);
  });

  it('counts only countable Expense rows: Income, neutral, CreditCard, Investments, future rows and Reversal are out', async () => {
    const future = DateTime.now().setZone(SP).plus({ days: 2 }).toISO() as string;
    const user = await fresh([
      { type: 'Expense', amount: '10.00', at: iso(1), name: 'Spotify' },
      { type: 'Income', amount: '100.00', at: iso(1), name: 'Spotify reembolso', category: 'Salaries' },
      { type: 'Income', amount: '100.00', at: iso(1), name: 'Spotify estorno', category: 'Reversal' },
      { type: 'Expense', amount: '1.00', at: iso(1), name: 'Spotify neutro', neutral: true },
      { type: 'Expense', amount: '2.00', at: iso(1), name: 'Spotify cartao', method: 'CreditCard' },
      { type: 'Expense', amount: '3.00', at: iso(1), name: 'Spotify invest', category: 'Investments' },
      { type: 'Expense', amount: '4.00', at: future, name: 'Spotify futuro' },
    ]);
    expect(await search(user, 'spotify')).toEqual({ points: [{ month: monthKey(1), total: '10.00' }, { month: monthKey(0), total: '0.00' }], total: '10.00', count: 1 });
  });

  it('starts at the first month with a match, fills empty months with 0.00 and ends at the current month', async () => {
    const user = await fresh([
      { type: 'Expense', amount: '9.00', at: iso(5), name: 'Academia' },
      { type: 'Expense', amount: '9.00', at: iso(1), name: 'Academia' },
      { type: 'Expense', amount: '700.00', at: iso(8), name: 'Mercado' },
    ]);
    const body = await search(user, 'academia', { 'x-timezone': SP });
    expect(body.points.map((p) => p.month)).toEqual([5, 4, 3, 2, 1, 0].map((n) => monthKey(n)));
    expect(body.points.map((p) => p.total)).toEqual(['9.00', '0.00', '0.00', '0.00', '9.00', '0.00']);
    expect(body.total).toBe('18.00');
    expect(body.count).toBe(2);
  });

  it('returns an empty list and zeros when nothing matches', async () => {
    const user = await fresh([{ type: 'Expense', amount: '9.00', at: iso(1), name: 'Mercado' }]);
    expect(await search(user, 'inexistente')).toEqual({ points: [], total: '0.00', count: 0 });
    expect(await search(await fresh(), 'x')).toEqual({ points: [], total: '0.00', count: 0 });
  });

  it('uses the user zone for the month of a row at 23:30 local on the last day of a month', async () => {
    const lastNight = DateTime.now().setZone(SP).startOf('month').minus({ days: 1 }).set({ hour: 23, minute: 30 });
    const user = await fresh([{ type: 'Expense', amount: '25.00', at: lastNight.toISO() as string, name: 'Aluguel' }]);
    const sp = await search(user, 'aluguel', { 'x-timezone': SP });
    expect(sp.points[0]).toEqual({ month: lastNight.toFormat('yyyy-MM'), total: '25.00' });
    // 02:30 UTC on the 1st: the UTC month is the one after.
    const utc = await search(user, 'aluguel', { 'x-timezone': 'UTC' });
    expect(utc.points[0]).toEqual({ month: lastNight.setZone('UTC').toFormat('yyyy-MM'), total: '25.00' });
    expect(utc.points[0]?.month).not.toBe(sp.points[0]?.month);
  });

  it('sums 1001 x 999999999999.99 exactly (no float)', async () => {
    const user = await fresh(
      Array.from({ length: 1001 }, (_, i) => ({ name: `Grande ${i}`, type: 'Expense' as const, amount: '999999999999.99', at: iso(1), category: 'Food' })),
    );
    const body = await search(user, 'grande');
    expect(body.count).toBe(1001);
    expect(body.total).toBe('1000999999999989.99');
    expect(body.points[0]?.total).toBe('1000999999999989.99');
  });

  it('keeps the text out of the SQL: a quote and an injection attempt are just text', async () => {
    const user = await fresh([{ type: 'Expense', amount: '1.00', at: iso(1), name: "O'Brien" }]);
    expect((await search(user, "o'brien")).count).toBe(1);
    expect(await search(user, "'; drop table public.transactions; --")).toEqual({ points: [], total: '0.00', count: 0 });
    expect((await search(user, "o'brien")).count).toBe(1);
  });

  it('isolates users', async () => {
    const mine = await fresh([{ type: 'Expense', amount: '3.00', at: iso(1), name: 'Cafe' }]);
    await fresh([{ type: 'Expense', amount: '900.00', at: iso(1), name: 'Cafe' }]);
    expect(await search(mine, 'cafe')).toMatchObject({ total: '3.00', count: 1 });
  });

  it.each([
    ['empty', '?q='],
    ['blank', `?q=${encodeURIComponent('   ')}`],
    ['missing', ''],
    ['81 characters', `?q=${'a'.repeat(81)}`],
    ['81 characters surrounded by spaces', `?q=${' '.repeat(5)}${'b'.repeat(81)}`],
  ])('rejects q %s with 422 invalid_query on field q', async (_name, query) => {
    const user = await fresh();
    const res = await get(app, user, `/dashboard/expense-search${query}`);
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toMatchObject({ code: 'invalid_query', field: 'q' });
  });

  it('accepts exactly 80 characters, also when padded with spaces', async () => {
    const user = await fresh();
    const eighty = 'a'.repeat(80);
    expect((await get(app, user, `/dashboard/expense-search?q=${eighty}`)).statusCode).toBe(200);
    expect((await get(app, user, `/dashboard/expense-search?q=${encodeURIComponent(`  ${eighty}  `)}`)).statusCode).toBe(200);
  });

  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/dashboard/expense-search?q=x' })).statusCode).toBe(401);
  });
});

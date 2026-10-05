import { randomUUID } from 'node:crypto';
import type { TransactionSql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { classify } from '../src/modules/import/classify.js';
import type { ClassifiedRow, ParsedRow } from '../src/modules/import/types.js';
import { createWithUser } from '../src/plugins/db.js';
import { cleanupTestUsers, closeAdminSql, createTestUser, getAdminSql, type TestUser } from './helpers/db.js';

afterAll(async () => {
  await cleanupTestUsers();
  await closeAdminSql();
});

const SAO_PAULO = 'America/Sao_Paulo';

/** The app's own transaction wrapper: `authenticated` role with the user's claims (RLS on). */
const asUser = <T>(user: TestUser, fn: (tx: TransactionSql) => Promise<T>): Promise<T> =>
  createWithUser(getAdminSql())({ sub: user.id, role: 'authenticated' }, fn);

interface Owner {
  user: TestUser;
  categoryId: string;
}

async function owner(): Promise<Owner> {
  const user = await createTestUser();
  const [category] = await getAdminSql()<{ id: string }[]>`
    select id from public.categories where user_id = ${user.id} and key = 'Uncategorized'`;
  return { user, categoryId: category?.id ?? '' };
}

async function account(o: Owner, holderNames: string[] = ['Fulano'], active = true): Promise<string> {
  const [row] = await getAdminSql()<{ id: string }[]>`
    insert into public.accounts (user_id, bank, nickname, holder_names, active)
    values (${o.user.id}, 'Nubank', ${`Conta ${randomUUID()}`}, ${holderNames}, ${active}) returning id`;
  return row?.id ?? '';
}

interface Existing {
  name?: string;
  type?: 'Income' | 'Expense';
  amount?: string;
  occurredAt?: string;
  identifier?: string | null;
}

/** Seeds an existing transaction with admin SQL. */
async function existing(o: Owner, accountId: string, over: Existing = {}): Promise<void> {
  await getAdminSql()`
    insert into public.transactions
      (user_id, account_id, category_id, name, type, occurred_at, amount, payment_method, identifier)
    values (${o.user.id}, ${accountId}, ${o.categoryId}, ${over.name ?? 'Mercado'}, ${over.type ?? 'Expense'},
            ${over.occurredAt ?? '2026-07-02T03:00:00Z'}, ${over.amount ?? '10.00'}, 'PIX', ${over.identifier ?? null})`;
}

function row(index: number, over: Partial<ParsedRow> = {}): ParsedRow {
  return {
    index,
    localDate: '2026-07-02',
    type: 'Expense',
    amount: '10.00',
    name: 'Mercado',
    paymentMethod: 'PIX',
    categoryKey: 'Uncategorized',
    identifier: `id-${index}`,
    counterpartyDocument: null,
    counterpartyBank: null,
    status: 'new',
    ...over,
  };
}

const run = (o: Owner, rows: ParsedRow[], accountId: string, tz = SAO_PAULO): Promise<ClassifiedRow[]> =>
  asUser(o.user, (tx) => classify(tx, rows, accountId, tz));

const statuses = (rows: ClassifiedRow[]) => rows.map((r) => [r.index, r.status]);

describe('classify: duplicates by external identifier', () => {
  it('marks a row whose identifier exists on the same account as duplicate, the others stay as parsed', async () => {
    const o = await owner();
    const acc = await account(o);
    await existing(o, acc, { identifier: 'id-0' });
    await existing(o, acc, { identifier: 'id-2' });

    const result = await run(o, [
      row(0),
      row(1),
      row(2, { status: 'unrecognized', reason: 'Unknown description' }),
      row(3, { status: 'unrecognized', reason: 'Unknown description' }),
    ], acc);

    expect(statuses(result)).toEqual([[0, 'duplicate'], [1, 'new'], [2, 'duplicate'], [3, 'unrecognized']]);
    // An unrecognized duplicate keeps its reason; every other field is unchanged.
    expect(result[2]).toEqual({ ...row(2, { reason: 'Unknown description' }), status: 'duplicate', neutral: false });
    expect(result[1]).toEqual({ ...row(1), neutral: false });
  });

  it('keeps a row as new when the identifier exists only on another account (own or another user\'s)', async () => {
    const o = await owner();
    const acc = await account(o);
    const otherAcc = await account(o);
    await existing(o, otherAcc, { identifier: 'id-0' });
    const stranger = await owner();
    await existing(stranger, await account(stranger), { identifier: 'id-1' });

    expect(statuses(await run(o, [row(0), row(1)], acc))).toEqual([[0, 'new'], [1, 'new']]);
  });

  it('marks the second occurrence of an identifier inside the file as duplicate', async () => {
    const o = await owner();
    const acc = await account(o);

    const result = await run(o, [
      row(0, { identifier: 'same' }),
      row(1, { identifier: 'other' }),
      row(2, { identifier: 'same', status: 'unrecognized', reason: 'r' }),
      row(3, { identifier: 'same' }),
    ], acc);

    expect(statuses(result)).toEqual([[0, 'new'], [1, 'new'], [2, 'duplicate'], [3, 'duplicate']]);
  });

  it('never touches ignored or invalid rows, and they do not count as a first occurrence', async () => {
    const o = await owner();
    const acc = await account(o);
    await existing(o, acc, { identifier: 'taken' });
    const ignored = row(0, { identifier: 'taken', status: 'ignored', type: 'Income' });
    const invalid = row(1, { identifier: 'taken', status: 'invalid', reason: 'Invalid date "x"' });
    const invalidFirst = row(2, { identifier: 'fresh', status: 'invalid', reason: 'Invalid or zero amount "0"' });
    const afterInvalid = row(3, { identifier: 'fresh' });

    const result = await run(o, [ignored, invalid, invalidFirst, afterInvalid], acc);

    expect(result).toEqual([
      { ...ignored, neutral: false },
      { ...invalid, neutral: false },
      { ...invalidFirst, neutral: false },
      { ...afterInvalid, neutral: false },
    ]);
  });
});

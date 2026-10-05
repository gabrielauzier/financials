import type { TransactionSql } from 'postgres';
import { getAdminSql, type TestUser } from './db.js';

/** Runs `fn` as the `authenticated` role with the given user's claims (raw SQL, no app code). */
export async function asUser<T>(userId: string, fn: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return getAdminSql().begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated' })}, true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  }) as Promise<T>;
}

export interface TxSeed {
  type: 'Income' | 'Expense';
  amount: string;
  /** ISO instant with offset. */
  at: string;
  /** Category key, e.g. 'Food', 'Reversal', 'Investments' (default 'Uncategorized'). */
  category?: string;
  method?: string;
  neutral?: boolean;
  accountId?: string;
  name?: string;
}

/** Inserts transactions directly (as the user, so RLS and FKs apply). */
export async function seedTransactions(user: TestUser, accountId: string, rows: TxSeed[]): Promise<void> {
  await asUser(user.id, async (tx) => {
    for (const r of rows) {
      await tx`
        insert into public.transactions (account_id, category_id, name, type, occurred_at, amount, payment_method, neutral)
        values (${r.accountId ?? accountId},
                (select id from public.categories where key = ${r.category ?? 'Uncategorized'}),
                ${r.name ?? 'seed'}, ${r.type}, ${r.at}, ${r.amount}, ${r.method ?? 'PIX'}, ${r.neutral ?? false})`;
    }
  });
}

export async function seedAccount(user: TestUser, nickname = 'Conta', active = true): Promise<string> {
  const [row] = await asUser(user.id, (tx) => tx<{ id: string }[]>`
    insert into public.accounts (bank, nickname, holder_names, active)
    values ('Nubank', ${nickname}, ${['Fulano']}, ${active}) returning id`);
  return row?.id ?? '';
}

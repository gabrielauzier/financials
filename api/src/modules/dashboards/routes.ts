import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { COUNTABLE, EXPENSE_VALUE, FROM_TRANSACTIONS, INCOME_VALUE, rule } from './rules.js';
import { last12Months, last30DaysWindow, previous30DaysWindow } from './time.js';

const Money = (description: string) => Type.String({ description });

const Last30DaysSchema = Type.Object({
  total: Money('Expenses of the 30 days ending today (inclusive), decimal string with 2 decimals'),
  previousTotal: Money('Expenses of the 30 days immediately before, decimal string with 2 decimals'),
  changePct: Type.Union([Type.Number(), Type.Null()], {
    description: '(total - previousTotal) / previousTotal * 100, 1 decimal; null when previousTotal is 0',
  }),
});

const TrendSchema = Type.Object({
  points: Type.Array(
    Type.Object({
      month: Type.String({ description: 'Local calendar month, YYYY-MM' }),
      income: Money('Income of the month, decimal string with 2 decimals'),
      expense: Money('Expense of the month (Reversal abates it), decimal string with 2 decimals'),
      balance: Money('income minus expense, decimal string with 2 decimals (may be negative)'),
    }),
    { description: 'Always 12 points, oldest first: the 11 previous months and the current one' },
  ),
});

export async function dashboardsRoutes(app: FastifyInstance): Promise<void> {
  const routes = app.withTypeProvider<TypeBoxTypeProvider>();

  routes.get(
    '/dashboard/last-30-days',
    { schema: { response: { 200: Last30DaysSchema } } },
    async (request) => {
      const now = new Date();
      const current = last30DaysWindow(now, request.tz);
      const previous = previous30DaysWindow(now, request.tz);
      const [row] = await request.withUser((tx) => tx<{ total: string; previous_total: string; change_pct: number | null }[]>`
        with sums as (
          select
            coalesce(sum(${rule(tx, EXPENSE_VALUE)}) filter (where t.occurred_at >= ${current.from} and t.occurred_at < ${current.to}), 0.00) as total,
            coalesce(sum(${rule(tx, EXPENSE_VALUE)}) filter (where t.occurred_at >= ${previous.from} and t.occurred_at < ${previous.to}), 0.00) as previous_total
          from ${rule(tx, FROM_TRANSACTIONS)}
          where ${rule(tx, COUNTABLE)}
            and t.occurred_at >= ${previous.from} and t.occurred_at < ${current.to}
        )
        select total::text as total,
               previous_total::text as previous_total,
               case when previous_total = 0 then null
                    else round((total - previous_total) / previous_total * 100, 1)::float8 end as change_pct
        from sums`);
      const sums = row as { total: string; previous_total: string; change_pct: number | null };
      return { total: sums.total, previousTotal: sums.previous_total, changePct: sums.change_pct };
    },
  );

  routes.get(
    '/dashboard/trend',
    { schema: { response: { 200: TrendSchema } } },
    async (request) => {
      const months = last12Months(new Date(), request.tz);
      const names = months.map((m) => m.month);
      const froms = months.map((m) => m.from.toISOString());
      const tos = months.map((m) => m.to.toISOString());
      const first = months[0]?.from as Date;
      const last = months[11]?.to as Date;
      const rows = await request.withUser((tx) => tx<{ month: string; income: string; expense: string; balance: string }[]>`
        with months(month, m_from, m_to) as (
          select * from unnest(${names}::text[], ${froms}::timestamptz[], ${tos}::timestamptz[])
        ),
        rows as (
          select t.occurred_at, ${rule(tx, INCOME_VALUE)} as income, ${rule(tx, EXPENSE_VALUE)} as expense
          from ${rule(tx, FROM_TRANSACTIONS)}
          where ${rule(tx, COUNTABLE)} and t.occurred_at >= ${first} and t.occurred_at < ${last}
        )
        select m.month,
               coalesce(sum(r.income), 0.00)::text as income,
               coalesce(sum(r.expense), 0.00)::text as expense,
               (coalesce(sum(r.income), 0.00) - coalesce(sum(r.expense), 0.00))::text as balance
        from months m
        left join rows r on r.occurred_at >= m.m_from and r.occurred_at < m.m_to
        group by m.month
        order by m.month`);
      return { points: rows.map((r) => ({ month: r.month, income: r.income, expense: r.expense, balance: r.balance })) };
    },
  );
}

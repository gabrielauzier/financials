import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { COUNTABLE, EXPENSE_VALUE, FROM_TRANSACTIONS, rule } from './rules.js';
import { last30DaysWindow, previous30DaysWindow } from './time.js';

const Money = (description: string) => Type.String({ description });

const Last30DaysSchema = Type.Object({
  total: Money('Expenses of the 30 days ending today (inclusive), decimal string with 2 decimals'),
  previousTotal: Money('Expenses of the 30 days immediately before, decimal string with 2 decimals'),
  changePct: Type.Union([Type.Number(), Type.Null()], {
    description: '(total - previousTotal) / previousTotal * 100, 1 decimal; null when previousTotal is 0',
  }),
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
}

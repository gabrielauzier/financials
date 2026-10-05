import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { CARD_PURCHASE, CARD_VALUE, COUNTABLE, EXPENSE_VALUE, FROM_TRANSACTIONS, INCOME_VALUE, NET_VALUE, OPEN_CREDIT_EXPENSE, rule } from './rules.js';
import { AppError } from '../../plugins/errors.js';
import {
  currentMonthWindow,
  last12Months,
  last30DaysWindow,
  localDate,
  localMonth,
  monthsFrom,
  periodWindow,
  previous30DaysWindow,
  type Window,
} from './time.js';

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

const NetWorthSchema = Type.Object({
  current: Money('Net worth now: income minus expenses plus investment returns, decimal string with 2 decimals'),
  series: Type.Array(
    Type.Object({
      month: Type.String({ description: 'Local calendar month, YYYY-MM' }),
      value: Money('Cumulative net worth at the end of the month, decimal string with 2 decimals'),
    }),
    { description: 'One point per month from the first month with a transaction or return to the current month; empty without data' },
  ),
});

const CardSchema = Type.Object({
  transactions: Type.Array(
    Type.Object({
      categoryName: Type.String(),
      total: Money('CreditCard purchases of the category in the period, decimal string with 2 decimals'),
    }),
    { description: 'CreditCard transactions in the period (neutral ones included) by category, largest first; never part of the totals of the other dashboards' },
  ),
  creditExpenses: Type.Array(
    Type.Object({
      categoryName: Type.String(),
      remaining: Money('Sum of totalAmount minus paidAmount, decimal string with 2 decimals'),
    }),
    { description: 'Active, Once and ToCancel credit expenses by category; an open balance, listed whatever the period' },
  ),
});

const PeriodQuery = Type.Object({
  from: Type.Optional(Type.String({ description: 'First local day, YYYY-MM-DD, inclusive; give both from and to or neither' })),
  to: Type.Optional(Type.String({ description: 'Last local day, YYYY-MM-DD, inclusive' })),
});

const CategoriesSchema = Type.Object({
  items: Type.Array(
    Type.Object({
      categoryId: Type.String({ format: 'uuid' }),
      name: Type.String({ description: 'Category name in Portuguese' }),
      total: Money('Expense of the category in the period, decimal string with 2 decimals; negative for Estorno'),
    }),
    { description: 'Largest first; categories whose total is zero are omitted; the sum equals the total expense of the period' },
  ),
});

/** Period of `from`/`to` (local dates, inclusive) or the current local month when both are absent. */
function requestedPeriod(query: { from?: string; to?: string }, zone: string): Window {
  const { from, to } = query;
  if (from === undefined && to === undefined) return currentMonthWindow(new Date(), zone);
  if (from === undefined || to === undefined) {
    throw new AppError('invalid_period', 422, 'from and to must be given together', from === undefined ? 'from' : 'to');
  }
  const window = periodWindow(from, to, zone);
  if (window) return window;
  const bad = periodWindow(from, from, zone) === null ? 'from' : periodWindow(to, to, zone) === null ? 'to' : 'from';
  throw new AppError('invalid_period', 422, 'from and to must be valid YYYY-MM-DD dates with from not after to', bad);
}

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

  routes.get(
    '/dashboard/categories',
    { schema: { querystring: PeriodQuery, response: { 200: CategoriesSchema } } },
    async (request) => {
      const period = requestedPeriod(request.query, request.tz);
      const rows = await request.withUser((tx) => tx<{ category_id: string; name: string; total: string }[]>`
        select c.id as category_id, c.name, sum(${rule(tx, EXPENSE_VALUE)})::text as total
        from ${rule(tx, FROM_TRANSACTIONS)}
        where ${rule(tx, COUNTABLE)} and t.occurred_at >= ${period.from} and t.occurred_at < ${period.to}
        group by c.id, c.name
        having sum(${rule(tx, EXPENSE_VALUE)}) <> 0
        order by sum(${rule(tx, EXPENSE_VALUE)}) desc, c.name`);
      return { items: rows.map((r) => ({ categoryId: r.category_id, name: r.name, total: r.total })) };
    },
  );

  routes.get(
    '/dashboard/net-worth',
    { schema: { response: { 200: NetWorthSchema } } },
    async (request) => {
      const now = new Date();
      const zone = request.tz;
      const today = localDate(now, zone);
      return request.withUser(async (tx) => {
        // The first month with any (non-future) transaction or return; the series starts there.
        const [first] = await tx<{ first_tx: Date | null; first_return: string | null }[]>`
          select (select min(occurred_at) from public.transactions where occurred_at <= now()) as first_tx,
                 (select min(occurred_on)::text from public.investment_returns where occurred_on <= ${today}::date) as first_return`;
        const candidates = [
          first?.first_tx ? localMonth(first.first_tx, zone) : undefined,
          first?.first_return ? first.first_return.slice(0, 7) : undefined,
        ].filter((m): m is string => m !== undefined);
        if (candidates.length === 0) return { current: '0.00', series: [] };

        const months = monthsFrom(candidates.sort()[0] as string, now, zone);
        const names = months.map((m) => m.month);
        const tos = months.map((m) => m.to.toISOString());
        const dateTos = months.map((m) => m.nextFirstDay);
        const rows = await tx<{ month: string; value: string }[]>`
          with months(month, m_to, d_to) as (
            select * from unnest(${names}::text[], ${tos}::timestamptz[], ${dateTos}::date[])
          ),
          moves as (
            select t.occurred_at, ${rule(tx, NET_VALUE)} as value
            from ${rule(tx, FROM_TRANSACTIONS)}
            where ${rule(tx, COUNTABLE)}
          ),
          returns as (
            select occurred_on, amount from public.investment_returns where occurred_on <= ${today}::date
          )
          select m.month,
                 (coalesce((select sum(value) from moves where occurred_at < m.m_to), 0.00)
                  + coalesce((select sum(amount) from returns where occurred_on < m.d_to), 0.00))::text as value
          from months m
          order by m.month`;
        const series = rows.map((r) => ({ month: r.month, value: r.value }));
        return { current: (series.at(-1) as { value: string }).value, series };
      });
    },
  );

  routes.get(
    '/dashboard/card',
    { schema: { querystring: PeriodQuery, response: { 200: CardSchema } } },
    async (request) => {
      const period = requestedPeriod(request.query, request.tz);
      return request.withUser(async (tx) => {
        const transactions = await tx<{ category_name: string; total: string }[]>`
          select c.name as category_name, sum(${rule(tx, CARD_VALUE)})::text as total
          from ${rule(tx, FROM_TRANSACTIONS)}
          where ${rule(tx, CARD_PURCHASE)} and t.occurred_at >= ${period.from} and t.occurred_at < ${period.to}
          group by c.id, c.name
          having sum(${rule(tx, CARD_VALUE)}) <> 0
          order by sum(${rule(tx, CARD_VALUE)}) desc, c.name`;
        const creditExpenses = await tx<{ category_name: string; remaining: string }[]>`
          select c.name as category_name, sum(ce.total_amount - ce.paid_amount)::text as remaining
          from public.credit_expenses ce
          join public.categories c on c.id = ce.category_id and c.user_id = ce.user_id
          where ${rule(tx, OPEN_CREDIT_EXPENSE)}
          group by c.id, c.name
          order by sum(ce.total_amount - ce.paid_amount) desc, c.name`;
        return {
          transactions: transactions.map((r) => ({ categoryName: r.category_name, total: r.total })),
          creditExpenses: creditExpenses.map((r) => ({ categoryName: r.category_name, remaining: r.remaining })),
        };
      });
    },
  );
}

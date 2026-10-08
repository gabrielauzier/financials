/**
 * Queries of the period-aware dashboards (trend, years, expense trend, expense search). All the
 * calculation rules come from `rules.ts` and all windows from `time.ts`; this file only shapes the
 * aggregation. Money is summed in SQL and returned as decimal text, never as a JS number.
 */
import { DateTime } from 'luxon';
import type { TransactionSql } from 'postgres';
import { COUNTABLE, EXPENSE_VALUE, FROM_TRANSACTIONS, INCOME_VALUE, rule } from './rules.js';
import type { MonthWindow, Window } from './time.js';

/** The months to chart plus the instants that decide which rows count (the ends may be partial months). */
export interface ReportPeriod {
  months: MonthWindow[];
  window: Window;
}

export interface TrendPoint {
  month: string;
  income: string;
  expense: string;
  balance: string;
}

export interface TrendResult {
  points: TrendPoint[];
  totals: { income: string; expense: string; balance: string };
}

export async function trendQuery(tx: TransactionSql, period: ReportPeriod): Promise<TrendResult> {
  const names = period.months.map((m) => m.month);
  const froms = period.months.map((m) => m.from.toISOString());
  const tos = period.months.map((m) => m.to.toISOString());
  const { from, to } = period.window;
  const rows = await tx<TrendPoint[]>`
    with months(month, m_from, m_to) as (
      select * from unnest(${names}::text[], ${froms}::timestamptz[], ${tos}::timestamptz[])
    ),
    rows as (
      select t.occurred_at, ${rule(tx, INCOME_VALUE)} as income, ${rule(tx, EXPENSE_VALUE)} as expense
      from ${rule(tx, FROM_TRANSACTIONS)}
      where ${rule(tx, COUNTABLE)} and t.occurred_at >= ${from} and t.occurred_at < ${to}
    )
    select m.month,
           coalesce(sum(r.income), 0.00)::text as income,
           coalesce(sum(r.expense), 0.00)::text as expense,
           (coalesce(sum(r.income), 0.00) - coalesce(sum(r.expense), 0.00))::text as balance
    from months m
    left join rows r on r.occurred_at >= m.m_from and r.occurred_at < m.m_to and r.occurred_at >= ${from} and r.occurred_at < ${to}
    group by m.month
    order by m.month`;
  const [totals] = await tx<TrendResult['totals'][]>`
    select coalesce(sum(${rule(tx, INCOME_VALUE)}), 0.00)::text as income,
           coalesce(sum(${rule(tx, EXPENSE_VALUE)}), 0.00)::text as expense,
           (coalesce(sum(${rule(tx, INCOME_VALUE)}), 0.00) - coalesce(sum(${rule(tx, EXPENSE_VALUE)}), 0.00))::text as balance
    from ${rule(tx, FROM_TRANSACTIONS)}
    where ${rule(tx, COUNTABLE)} and t.occurred_at >= ${from} and t.occurred_at < ${to}`;
  return {
    points: rows.map((r) => ({ month: r.month, income: r.income, expense: r.expense, balance: r.balance })),
    totals: totals as TrendResult['totals'],
  };
}

/** Local years (descending) with at least one countable transaction. */
export async function yearsQuery(tx: TransactionSql, zone: string): Promise<number[]> {
  const [bounds] = await tx<{ first: Date | null; last: Date | null }[]>`
    select min(t.occurred_at) as first, max(t.occurred_at) as last
    from ${rule(tx, FROM_TRANSACTIONS)}
    where ${rule(tx, COUNTABLE)}`;
  if (!bounds?.first || !bounds.last) return [];
  const firstYear = DateTime.fromJSDate(bounds.first, { zone }).year;
  const lastYear = DateTime.fromJSDate(bounds.last, { zone }).year;
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);
  const froms = years.map((y) => DateTime.fromObject({ year: y }, { zone }).toJSDate().toISOString());
  const tos = years.map((y) => DateTime.fromObject({ year: y + 1 }, { zone }).toJSDate().toISOString());
  const rows = await tx<{ year: number }[]>`
    with years(year, y_from, y_to) as (
      select * from unnest(${years}::int[], ${froms}::timestamptz[], ${tos}::timestamptz[])
    )
    select y.year
    from years y
    where exists (
      select 1 from ${rule(tx, FROM_TRANSACTIONS)}
      where ${rule(tx, COUNTABLE)} and t.occurred_at >= y.y_from and t.occurred_at < y.y_to
    )
    order by y.year desc`;
  return rows.map((r) => r.year);
}

export interface ExpenseTrendResult {
  months: string[];
  categories: { categoryId: string; name: string; color: string }[];
  points: { month: string; values: Record<string, string> }[];
}

export async function expenseTrendQuery(tx: TransactionSql, period: ReportPeriod): Promise<ExpenseTrendResult> {
  const names = period.months.map((m) => m.month);
  const froms = period.months.map((m) => m.from.toISOString());
  const tos = period.months.map((m) => m.to.toISOString());
  const { from, to } = period.window;
  const rows = await tx<{ category_id: string; name: string; color: string; month: string; value: string }[]>`
    with months(month, m_from, m_to) as (
      select * from unnest(${names}::text[], ${froms}::timestamptz[], ${tos}::timestamptz[])
    ),
    rows as (
      select t.occurred_at, c.id as category_id, c.name, c.color, ${rule(tx, EXPENSE_VALUE)} as value
      from ${rule(tx, FROM_TRANSACTIONS)}
      where ${rule(tx, COUNTABLE)} and t.occurred_at >= ${from} and t.occurred_at < ${to}
    ),
    cats as (
      select category_id, name, color, sum(value) as total
      from rows
      group by category_id, name, color
      having sum(value) <> 0
    )
    select k.category_id, k.name, k.color, m.month, coalesce(sum(r.value), 0.00)::text as value
    from cats k
    cross join months m
    left join rows r on r.category_id = k.category_id and r.occurred_at >= m.m_from and r.occurred_at < m.m_to
    group by k.category_id, k.name, k.color, k.total, m.month
    order by k.total desc, k.name, k.category_id, m.month`;
  const categories: ExpenseTrendResult['categories'] = [];
  const byMonth = new Map<string, Record<string, string>>(names.map((m) => [m, {}]));
  for (const r of rows) {
    if (categories.at(-1)?.categoryId !== r.category_id) categories.push({ categoryId: r.category_id, name: r.name, color: r.color });
    (byMonth.get(r.month) as Record<string, string>)[r.category_id] = r.value;
  }
  return { months: names, categories, points: names.map((month) => ({ month, values: byMonth.get(month) as Record<string, string> })) };
}

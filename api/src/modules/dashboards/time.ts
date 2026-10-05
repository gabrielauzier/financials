/**
 * Time boundaries of the dashboards (AD-005). Every window is computed here with Luxon from the
 * request's IANA zone and passed to SQL as `timestamptz` parameters; SQL only aggregates.
 * Windows are half-open: `[from, to)`, so a row at the exact `to` instant belongs to the next window.
 */
import { DateTime } from 'luxon';

export interface Window {
  /** Inclusive start instant. */
  from: Date;
  /** Exclusive end instant. */
  to: Date;
}

export interface MonthWindow extends Window {
  /** `YYYY-MM` in the user's zone. */
  month: string;
  /** Local date `YYYY-MM-DD` of the first day of the month. */
  firstDay: string;
  /** Local date `YYYY-MM-DD` of the first day of the next month (exclusive end for date columns). */
  nextFirstDay: string;
}

const MONTH_FORMAT = 'yyyy-MM';
const DATE_FORMAT = 'yyyy-MM-dd';

function localDay(now: Date, zone: string): DateTime {
  return DateTime.fromJSDate(now, { zone }).startOf('day');
}

/** Start of the local day, `daysBack` days before the day that contains `now`. */
function dayStart(now: Date, zone: string, daysBack: number): Date {
  return localDay(now, zone).minus({ days: daysBack }).toJSDate();
}

/** The 30 calendar days ending today (inclusive): `[start of D-29, start of D+1)`. */
export function last30DaysWindow(now: Date, zone: string): Window {
  return { from: dayStart(now, zone, 29), to: dayStart(now, zone, -1) };
}

/** The 30 calendar days immediately before `last30DaysWindow`: `[start of D-59, start of D-29)`. */
export function previous30DaysWindow(now: Date, zone: string): Window {
  return { from: dayStart(now, zone, 59), to: dayStart(now, zone, 29) };
}

function monthWindow(first: DateTime): MonthWindow {
  return {
    month: first.toFormat(MONTH_FORMAT),
    from: first.toJSDate(),
    to: first.plus({ months: 1 }).startOf('month').toJSDate(),
    firstDay: first.toFormat(DATE_FORMAT),
    nextFirstDay: first.plus({ months: 1 }).startOf('month').toFormat(DATE_FORMAT),
  };
}

/** The current local month plus the 11 before it, oldest first, crossing year boundaries. */
export function last12Months(now: Date, zone: string): MonthWindow[] {
  const current = DateTime.fromJSDate(now, { zone }).startOf('month');
  return Array.from({ length: 12 }, (_, i) => monthWindow(current.minus({ months: 11 - i })));
}

/** Local month `YYYY-MM` of an instant in the zone. */
export function localMonth(instant: Date, zone: string): string {
  return DateTime.fromJSDate(instant, { zone }).toFormat(MONTH_FORMAT);
}

/**
 * Every month from `firstMonth` (`YYYY-MM`) to the current local month, inclusive, oldest first.
 * Empty when `firstMonth` is after the current month.
 */
export function monthsFrom(firstMonth: string, now: Date, zone: string): MonthWindow[] {
  const current = DateTime.fromJSDate(now, { zone }).startOf('month');
  let cursor = monthBounds(firstMonth, zone);
  const out: MonthWindow[] = [];
  let at = DateTime.fromJSDate(cursor.from, { zone });
  while (at <= current) {
    cursor = monthBounds(at.toFormat(MONTH_FORMAT), zone);
    out.push(cursor);
    at = at.plus({ months: 1 }).startOf('month');
  }
  return out;
}

/** The calendar month `YYYY-MM`'s instants in the zone. Throws on a malformed month. */
export function monthBounds(month: string, zone: string): MonthWindow {
  const first = DateTime.fromFormat(month, MONTH_FORMAT, { zone });
  if (!first.isValid) throw new Error(`Invalid month: ${month}`);
  return monthWindow(first);
}

/** The current local month, `[first day 00:00, first day of next month 00:00)`. */
export function currentMonthWindow(now: Date, zone: string): Window {
  const { from, to } = monthWindow(DateTime.fromJSDate(now, { zone }).startOf('month'));
  return { from, to };
}

/** Local date `YYYY-MM-DD` of an instant in the zone. */
export function localDate(now: Date, zone: string): string {
  return DateTime.fromJSDate(now, { zone }).toFormat(DATE_FORMAT);
}

/**
 * `from`/`to` are inclusive local dates (`YYYY-MM-DD`): the window runs from the start of `from` to
 * the start of the day after `to`. Returns null when either date is malformed (including a
 * non-existent day such as 2026-02-30) or `from` is after `to`.
 */
export function periodWindow(from: string, to: string, zone: string): Window | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const start = DateTime.fromFormat(from, DATE_FORMAT, { zone });
  const end = DateTime.fromFormat(to, DATE_FORMAT, { zone });
  if (!start.isValid || !end.isValid || start > end) return null;
  return { from: start.toJSDate(), to: end.plus({ days: 1 }).startOf('day').toJSDate() };
}

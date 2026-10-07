import { formatBRL } from "@/lib/format";
import type {
  TransactionFilters,
  TransactionSummaryFilters,
  TransactionType,
} from "@/lib/api/types";

export function parseBRLToDecimal(value: string): string | null {
  const clean = value.trim().replace(/\s/g, "");
  if (!/^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$|^\d+(?:,\d{1,2})?$/.test(clean)) return null;
  const decimal = clean.replace(/\./g, "").replace(",", ".");
  if (/^0+(?:\.0{1,2})?$/.test(decimal)) return null;
  const [integer = "0", fraction] = decimal.split(".");
  return `${integer.replace(/^0+(?=\d)/, "")}${fraction === undefined ? "" : `.${fraction.padEnd(2, "0")}`}`;
}

export function toLocalDateInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/**
 * Weekday abbreviation of the LOCAL day of an instant, in the same zone `formatDateLocal` shows the date in
 * (the browser's), so the date and its weekday never disagree. Empty for an invalid instant. Never parses a
 * bare `YYYY-MM-DD` with `new Date`, which would read it as UTC midnight and give the previous day in Brazil.
 */
export function weekdayAbbrev(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return WEEKDAYS[date.getDay()] ?? "";
}

export type QuickMonth = { year?: number; month?: number };
export type FilterState = { filters: TransactionFilters; quick: QuickMonth };

/** First and last day (`YYYY-MM-DD`) of a month (1 to 12). Calendar arithmetic only: no local-time `Date`. */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  return { from: `${yyyy}-${mm}-01`, to: `${yyyy}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

/** Sets (or, for "", removes) `from`/`to`, goes back to page 1 and turns the quick month filter off. */
export function applyDateFilter(
  state: FilterState,
  key: "from" | "to",
  value: string,
): FilterState {
  const filters: TransactionFilters = { ...state.filters, page: 1 };
  if (value === "") delete filters[key];
  else filters[key] = value;
  return { filters, quick: {} };
}

/** Today in the user's local time zone as `YYYY-MM-DD` (local getters, never `toISOString`). */
export function todayLocal(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Color classes of a signed amount: red for an expense, green for an income. */
export function amountClassName(type: TransactionType): string {
  return type === "Expense"
    ? "whitespace-nowrap font-semibold text-destructive"
    : "whitespace-nowrap font-semibold text-emerald-700 dark:text-emerald-400";
}

/** An expense shows a single leading "-" (whether or not the amount carries one); an income has none. */
export function formatSignedAmount(type: TransactionType, amount: string): string {
  if (type === "Income") return formatBRL(amount);
  return `-${formatBRL(amount.trim().replace(/^-/, ""))}`;
}

/**
 * The filters that change the summary: the list filters without the sort, the page and the page size, which only
 * choose which rows of the same set are shown. Equal for any page, order or size, so those never refetch it.
 */
export function summaryFilters(filters: TransactionFilters): TransactionSummaryFilters {
  const { sort: _sort, order: _order, page: _page, pageSize: _pageSize, ...rest } = filters;
  return rest;
}

import type { TransactionFilters } from "@/lib/api/types";

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

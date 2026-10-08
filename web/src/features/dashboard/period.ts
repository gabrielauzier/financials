import { monthRange } from "@/features/transactions/utils";
import type { DashboardPeriod } from "@/lib/api/types";

/** `rolling12` is the trend cards' default: no period is sent and the API answers the last 12 months. */
export type PeriodKey = "rolling12" | "current" | "previous" | "last90" | "monthYear" | "custom";
/**
 * `from`/`to` belong to `custom` only and `month`/`year` to `monthYear` only: each mode ignores the other's
 * fields, which is how the two ways of choosing a period exclude each other.
 */
export type PeriodState = {
  key: PeriodKey;
  from: string;
  to: string;
  month: number | null;
  year: number | null;
};

export const periodLabels: Record<PeriodKey, string> = {
  rolling12: "Últimos 12 meses",
  current: "Mês atual",
  previous: "Mês anterior",
  last90: "Últimos 90 dias",
  monthYear: "Mês e ano",
  custom: "Personalizado",
};
const labelKeys = Object.keys(periodLabels) as PeriodKey[];
/** Options of the cards that always send a period. */
export const periodKeys = labelKeys.filter((key) => key !== "rolling12");
/** Options of the trend cards, which also offer the rolling 12 months (no period sent). */
export const trendPeriodKeys = labelKeys;

export const initialPeriod = (key: PeriodKey = "current"): PeriodState => ({
  key,
  from: "",
  to: "",
  month: null,
  year: null,
});
export const initialTrendPeriod = () => initialPeriod("rolling12");

const pad = (value: number) => String(value).padStart(2, "0");
const iso = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export type ResolvedPeriod =
  | { status: "ok"; period: DashboardPeriod }
  | { status: "default" }
  | { status: "incomplete" }
  | { status: "invalid" };

/** Local calendar dates, inclusive on both ends; `from`/`to` are YYYY-MM-DD strings. */
export function resolvePeriod(state: PeriodState, now = new Date()): ResolvedPeriod {
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (state.key) {
    case "rolling12":
      return { status: "default" };
    case "current":
      return {
        status: "ok",
        period: { from: iso(new Date(year, month, 1)), to: iso(new Date(year, month + 1, 0)) },
      };
    case "previous":
      return {
        status: "ok",
        period: { from: iso(new Date(year, month - 1, 1)), to: iso(new Date(year, month, 0)) },
      };
    case "last90":
      return {
        status: "ok",
        period: { from: iso(new Date(year, month, now.getDate() - 89)), to: iso(now) },
      };
    case "monthYear":
      if (state.month === null || state.year === null) return { status: "incomplete" };
      return { status: "ok", period: monthRange(state.year, state.month) };
    case "custom":
      if (!state.from || !state.to) return { status: "incomplete" };
      if (state.from > state.to) return { status: "invalid" };
      return { status: "ok", period: { from: state.from, to: state.to } };
  }
}

/**
 * What a query hook takes: the period to send, `undefined` for the API default (no parameters) and `null`
 * while the choice is incomplete or invalid (no request).
 */
export function queryPeriod(resolved: ResolvedPeriod): DashboardPeriod | null | undefined {
  if (resolved.status === "ok") return resolved.period;
  return resolved.status === "default" ? undefined : null;
}

/** The whole calendar year, January 1st to December 31st. */
export const yearPeriod = (year: number): DashboardPeriod => ({
  from: monthRange(year, 1).from,
  to: monthRange(year, 12).to,
});

/** The period a state is showing, if it is a complete one (used to mark the active year shortcut). */
export function shownPeriod(state: PeriodState): DashboardPeriod | null {
  const resolved = resolvePeriod(state);
  return resolved.status === "ok" ? resolved.period : null;
}

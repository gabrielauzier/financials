import type { DashboardPeriod } from "@/lib/api/types";

export type PeriodKey = "current" | "previous" | "last90" | "custom";
export type PeriodState = { key: PeriodKey; from: string; to: string };

export const periodLabels: Record<PeriodKey, string> = {
  current: "Mês atual",
  previous: "Mês anterior",
  last90: "Últimos 90 dias",
  custom: "Personalizado",
};
export const periodKeys = Object.keys(periodLabels) as PeriodKey[];

export const initialPeriod = (): PeriodState => ({ key: "current", from: "", to: "" });

const pad = (value: number) => String(value).padStart(2, "0");
const iso = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export type ResolvedPeriod =
  { status: "ok"; period: DashboardPeriod } | { status: "incomplete" } | { status: "invalid" };

/** Local calendar dates, inclusive on both ends; `from`/`to` are YYYY-MM-DD strings. */
export function resolvePeriod(state: PeriodState, now = new Date()): ResolvedPeriod {
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (state.key) {
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
    case "custom":
      if (!state.from || !state.to) return { status: "incomplete" };
      if (state.from > state.to) return { status: "invalid" };
      return { status: "ok", period: { from: state.from, to: state.to } };
  }
}

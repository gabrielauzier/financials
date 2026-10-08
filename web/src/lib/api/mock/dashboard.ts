import type {
  CardView,
  CategoryDistribution,
  DashboardYears,
  Last30Days,
  NetWorth,
  Trend,
} from "../types";
import { mockApiError, type MockHandler } from "./index";
import { localIsoDate, localMonth } from "./dates";
import { listMockInvestmentReturns, resetInvestmentReturnsMock } from "./investmentReturns";

let empty = false;

/** Test hook: "empty" mimics a user with no accounts or transactions ("sem dados"). */
export function setMockDataMode(mode: "seeded" | "empty") {
  empty = mode === "empty";
  resetInvestmentReturnsMock(mode);
}

// Money in the mock is computed on integer cents, never on floats.
const toCents = (value: string) => {
  const negative = value.startsWith("-");
  const [integer = "0", fraction = ""] = value.replace("-", "").split(".");
  const cents = BigInt(integer) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
};
const fromCents = (cents: bigint) => {
  const abs = cents < 0n ? -cents : cents;
  return `${cents < 0n ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
};

// [income, expense] per month, oldest first (the last pair is the current month).
const monthly: [string, string][] = [
  ["5200.00", "3900.00"],
  ["5200.00", "4100.00"],
  ["5350.00", "3800.00"],
  ["5200.00", "4500.00"],
  ["6100.00", "4200.00"],
  ["5200.00", "3950.00"],
  ["5200.00", "4300.00"],
  ["5200.00", "5100.00"],
  ["5400.00", "4000.00"],
  ["5200.00", "4150.00"],
  ["5200.00", "3980.00"],
  ["5200.00", "3170.50"],
];

const categoryIds = {
  food: "70000000-0000-4000-8000-000000000001",
  housing: "70000000-0000-4000-8000-000000000002",
  transport: "70000000-0000-4000-8000-000000000003",
  reversal: "70000000-0000-4000-8000-000000000004",
};

function months(): string[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => localMonth(now, index - 11));
}

function last30Days(): Last30Days {
  if (empty) return { total: "0.00", previousTotal: "0.00", changePct: null };
  return { total: "1850.40", previousTotal: "1500.00", changePct: 23.4 };
}

/** Months between two YYYY-MM-DD days, both ends included (the month of `from` to the month of `to`). */
function monthsBetween(from: string, to: string): string[] {
  const result: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const last = to.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    result.push(key);
    if (key >= last) return result;
    month += 1;
    if (month > 12) [year, month] = [year + 1, 1];
  }
}

const MAX_PERIOD_MONTHS = 120;

/** Without parameters: the rolling 12 months. With both: one point per month of the period (max 120). */
function trend({ path }: { path: string }): Trend {
  const params = new URL(path, "http://mock.local").searchParams;
  const hasPeriod = params.has("from") || params.has("to");
  const period = hasPeriod ? parsePeriod(path) : null;
  const rolling = months();
  const list = period ? monthsBetween(period.from, period.to) : rolling;
  if (list.length > MAX_PERIOD_MONTHS)
    throw mockApiError("invalid_period", "Período inválido", 422, "to");
  const points = list.map((month) => {
    const index = rolling.indexOf(month);
    const [income, expense] =
      empty || index < 0 ? ["0.00", "0.00"] : (monthly[index] as [string, string]);
    return { month, income, expense, balance: fromCents(toCents(income) - toCents(expense)) };
  });
  const sum = (pick: (point: (typeof points)[number]) => string) =>
    fromCents(points.reduce((total, point) => total + toCents(pick(point)), 0n));
  return {
    points,
    totals: {
      income: sum((p) => p.income),
      expense: sum((p) => p.expense),
      balance: sum((p) => p.balance),
    },
  };
}

/** Years of the months that have data, newest first; none without data. */
function years(): DashboardYears {
  if (empty) return { years: [] };
  return {
    years: [...new Set(months().map((month) => Number(month.slice(0, 4))))].sort((a, b) => b - a),
  };
}

function netWorth(): NetWorth {
  if (empty) return { current: "0.00", series: [] };
  const returns = listMockInvestmentReturns();
  let cumulative = 0n;
  const series = months().map((month, index) => {
    const [income, expense] = monthly[index] as [string, string];
    cumulative += toCents(income) - toCents(expense);
    const gains = returns
      .filter((item) => item.occurredOn.slice(0, 7) <= month)
      .reduce((sum, item) => sum + toCents(item.amount), 0n);
    return { month, value: fromCents(cumulative + gains) };
  });
  return { current: series.at(-1)?.value ?? "0.00", series };
}

function parsePeriod(path: string): { from: string; to: string } {
  const params = new URL(path, "http://mock.local").searchParams;
  const from = params.get("from");
  const to = params.get("to");
  if (from === null && to === null) {
    const now = new Date();
    return {
      from: localIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: localIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  const valid = (value: string | null) => value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!valid(from) || !valid(to) || (from as string) > (to as string))
    throw mockApiError("invalid_period", "Período inválido", 422, from === null ? "from" : "to");
  return { from: from as string, to: to as string };
}

const includesToday = ({ from, to }: { from: string; to: string }) => {
  const today = localIsoDate(new Date());
  return from <= today && today <= to;
};

function categories(path: string): CategoryDistribution {
  const period = parsePeriod(path);
  if (empty) return { items: [] };
  if (includesToday(period))
    return {
      items: [
        { categoryId: categoryIds.housing, name: "Moradia", total: "1200.00" },
        { categoryId: categoryIds.food, name: "Alimentação", total: "850.00" },
        { categoryId: categoryIds.transport, name: "Transporte", total: "320.50" },
        { categoryId: categoryIds.reversal, name: "Estorno (de compras)", total: "-45.90" },
      ],
    };
  return {
    items: [
      { categoryId: categoryIds.housing, name: "Moradia", total: "1200.00" },
      { categoryId: categoryIds.food, name: "Alimentação", total: "910.00" },
      { categoryId: categoryIds.transport, name: "Transporte", total: "275.30" },
    ],
  };
}

function card(path: string): CardView {
  const period = parsePeriod(path);
  if (empty) return { transactions: [], creditExpenses: [] };
  const creditExpenses = [
    { categoryName: "Compras", remaining: "4000.00" },
    { categoryName: "Entretenimento", remaining: "77.80" },
    { categoryName: "Transporte", remaining: "1200.00" },
  ];
  return includesToday(period)
    ? {
        transactions: [
          { categoryName: "Alimentação", total: "430.20" },
          { categoryName: "Compras", total: "699.90" },
          { categoryName: "Transporte", total: "120.00" },
        ],
        creditExpenses,
      }
    : {
        transactions: [
          { categoryName: "Alimentação", total: "380.00" },
          { categoryName: "Compras", total: "210.00" },
          { categoryName: "Transporte", total: "95.40" },
        ],
        creditExpenses,
      };
}

export const dashboardHandlers: MockHandler[] = [
  { method: "GET", path: "/dashboard/last-30-days", handle: last30Days },
  { method: "GET", path: /^\/dashboard\/trend(?:\?.*)?$/, handle: trend },
  { method: "GET", path: "/dashboard/years", handle: years },
  { method: "GET", path: "/dashboard/net-worth", handle: netWorth },
  {
    method: "GET",
    path: /^\/dashboard\/categories(?:\?.*)?$/,
    handle: ({ path }) => categories(path),
  },
  { method: "GET", path: /^\/dashboard\/card(?:\?.*)?$/, handle: ({ path }) => card(path) },
];

import type { TransactionFilters } from "@/lib/api/types";
import { monthRange, type FilterState, type QuickMonth } from "./utils";

type Sort = NonNullable<TransactionFilters["sort"]>;
type Order = NonNullable<TransactionFilters["order"]>;

/** The extrato filters a saved filter holds. No page and no page size: those are not part of a filter. */
export type SavedFilterState = {
  q?: string;
  type?: "Income" | "Expense";
  accountId?: string;
  categoryId?: string;
  neutral?: boolean;
  from?: string;
  to?: string;
  /** Only a complete quick month; `from` and `to` are then the days of that month. */
  quick?: { year: number; month: number };
  sort: Sort;
  order: Order;
};

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const SORTS: readonly Sort[] = ["date", "name", "amount", "category"];
const SORT_LABELS: Record<Sort, string> = {
  date: "Data",
  name: "Nome",
  amount: "Valor",
  category: "Categoria",
};
const MAX_TEXT_LENGTH = 200;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** A trimmed, non-empty text of at most 200 characters, else `undefined`. */
const textOf = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text !== "" && text.length <= MAX_TEXT_LENGTH ? text : undefined;
};
/** A real calendar day written `YYYY-MM-DD`. */
const dayOf = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // an overflowing day (30 of February, day 0) rolls the date into another month
  const real = date.getUTCMonth() === month - 1;
  return real ? value : undefined;
};
const quickOf = (value: unknown): { year: number; month: number } | undefined => {
  if (!isRecord(value)) return undefined;
  const { year, month } = value;
  const validYear = typeof year === "number" && Number.isInteger(year) && year >= 1900;
  const validMonth = typeof month === "number" && Number.isInteger(month);
  if (!validYear || !validMonth || year > 2100 || month < 1 || month > 12) return undefined;
  return { year, month };
};

/**
 * Turns anything (a stored value, an extrato state in disguise) into a valid saved state: unknown fields are
 * dropped, an invalid field is absent, `sort` and `order` fall back to date descending, and a quick month
 * takes over `from` and `to`.
 */
export function sanitizeSavedState(raw: unknown): SavedFilterState {
  const source = isRecord(raw) ? raw : {};
  const q = textOf(source["q"]);
  const accountId = textOf(source["accountId"]);
  const categoryId = textOf(source["categoryId"]);
  const quick = quickOf(source["quick"]);
  const days = quick
    ? monthRange(quick.year, quick.month)
    : { from: dayOf(source["from"]), to: dayOf(source["to"]) };
  const sort = SORTS.find((name) => name === source["sort"]) ?? "date";
  // the key order is fixed, so the stored text is the same for the same filter
  return {
    ...(q !== undefined && { q }),
    ...((source["type"] === "Income" || source["type"] === "Expense") && { type: source["type"] }),
    ...(accountId !== undefined && { accountId }),
    ...(categoryId !== undefined && { categoryId }),
    ...(typeof source["neutral"] === "boolean" && { neutral: source["neutral"] }),
    ...(days.from !== undefined && { from: days.from }),
    ...(days.to !== undefined && { to: days.to }),
    ...(quick && { quick }),
    sort,
    order: source["order"] === "asc" ? "asc" : "desc",
  };
}

/** The saved form of an extrato state: no page, no page size, only a complete quick month. */
export function toSavedState({ filters, quick }: FilterState): SavedFilterState {
  const complete = quick.year !== undefined && quick.month !== undefined;
  return sanitizeSavedState({ ...filters, quick: complete ? quick : undefined });
}

/** The extrato state a saved filter stands for, on page 1. */
export function toFilterState(saved: SavedFilterState): FilterState {
  const filters: TransactionFilters = { sort: saved.sort, order: saved.order, page: 1 };
  if (saved.q !== undefined) filters.q = saved.q;
  if (saved.type !== undefined) filters.type = saved.type;
  if (saved.accountId !== undefined) filters.accountId = saved.accountId;
  if (saved.categoryId !== undefined) filters.categoryId = saved.categoryId;
  if (saved.neutral !== undefined) filters.neutral = saved.neutral;
  if (saved.from !== undefined) filters.from = saved.from;
  if (saved.to !== undefined) filters.to = saved.to;
  const quick: QuickMonth = saved.quick ? { ...saved.quick } : {};
  if (saved.quick) Object.assign(filters, monthRange(saved.quick.year, saved.quick.month));
  return { filters, quick };
}

/** True when no filter is applied and the sort is the initial one (date, descending). */
export function isDefaultState(saved: SavedFilterState): boolean {
  const { sort, order, ...fields } = sanitizeSavedState(saved);
  return Object.keys(fields).length === 0 && sort === "date" && order === "desc";
}

const canonical = (saved: SavedFilterState) => {
  const s = sanitizeSavedState(saved);
  return JSON.stringify([
    s.q ?? null,
    s.type ?? null,
    s.accountId ?? null,
    s.categoryId ?? null,
    s.neutral ?? null,
    s.from ?? null,
    s.to ?? null,
    s.quick ? [s.quick.year, s.quick.month] : null,
    s.sort,
    s.order,
  ]);
};
/** Equal in all ten fields; the key order, a blank `q` and the page do not count. */
export function sameSavedState(a: SavedFilterState, b: SavedFilterState): boolean {
  return canonical(a) === canonical(b);
}

/**
 * Drops the account and the category the known lists no longer have, and says which went. A list that is
 * not known (still loading, or failed) keeps its field: there is no way to tell.
 */
export function withoutMissingRefs(
  saved: SavedFilterState,
  known: { accountIds?: ReadonlySet<string>; categoryIds?: ReadonlySet<string> },
): { state: SavedFilterState; missing: Array<"account" | "category"> } {
  const state = { ...saved };
  const missing: Array<"account" | "category"> = [];
  if (state.accountId !== undefined && known.accountIds && !known.accountIds.has(state.accountId)) {
    delete state.accountId;
    missing.push("account");
  }
  if (
    state.categoryId !== undefined &&
    known.categoryIds &&
    !known.categoryIds.has(state.categoryId)
  ) {
    delete state.categoryId;
    missing.push("category");
  }
  return { state, missing };
}

/** `YYYY-MM-DD` as `dd/mm/yyyy`, from the text (never through `Date`, which would shift the day by zone). */
const formatDay = (day: string) => day.split("-").reverse().join("/");

/** The summary lines of what a saved state holds: one per applied field, and always the sort. */
export function describeSavedState(
  saved: SavedFilterState,
  names: { account?: string | undefined; category?: string | undefined } = {},
): string[] {
  const lines: string[] = [];
  if (saved.q !== undefined) lines.push(`Busca: ${saved.q}`);
  if (saved.type !== undefined)
    lines.push(`Tipo: ${saved.type === "Income" ? "Receita" : "Despesa"}`);
  if (saved.accountId !== undefined) {
    lines.push(`Conta: ${names.account ?? "Conta selecionada"}`);
  }
  if (saved.categoryId !== undefined) {
    lines.push(`Categoria: ${names.category ?? "Categoria selecionada"}`);
  }
  if (saved.neutral !== undefined) lines.push(`Neutra: ${saved.neutral ? "Sim" : "Não"}`);
  if (saved.quick) {
    lines.push(`Mês: ${MONTH_NAMES[saved.quick.month - 1]} de ${saved.quick.year}`);
  } else {
    if (saved.from !== undefined) lines.push(`De: ${formatDay(saved.from)}`);
    if (saved.to !== undefined) lines.push(`Até: ${formatDay(saved.to)}`);
  }
  lines.push(
    `Ordenação: ${SORT_LABELS[saved.sort]} (${saved.order === "asc" ? "crescente" : "decrescente"})`,
  );
  return lines;
}

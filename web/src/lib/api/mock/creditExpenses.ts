import type {
  CreditExpense,
  CreditExpenseInput,
  CreditExpenseStatus,
  CreditExpenseUpdate,
} from "../types";
import { mockApiError, type MockHandler } from "./index";
import { listMockAccounts } from "./accounts";
import { listMockCategories } from "./categories";

const statuses: CreditExpenseStatus[] = ["Once", "Active", "Inactive", "Canceled", "ToCancel"];

// Amounts are strict decimal strings; arithmetic runs on integer cents, never on floats.
const DECIMAL = /^\d+(?:\.\d{1,2})?$/;
const toCents = (value: string) => {
  const [integer = "0", fraction = ""] = value.split(".");
  return BigInt(integer) * 100n + BigInt(fraction.padEnd(2, "0"));
};
const fromCents = (cents: bigint) => `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
const normalizeAmount = (value: string) => fromCents(toCents(value));
const remainingOf = (total: string, paid: string) => fromCents(toCents(total) - toCents(paid));

const accountFor = (id: string) => listMockAccounts().find((item) => item.id === id);
const categoryFor = (id: string) => listMockCategories().find((item) => item.id === id);
const uncategorized = () => listMockCategories().find((item) => item.key === "Uncategorized");
const categoryByKey = (key: string) => listMockCategories().find((item) => item.key === key);

const seedRows: [string, string, string, number, CreditExpenseStatus, string, string | null][] = [
  ["Netflix", "55.90", "0.00", 5, "Active", "Entertainment", null],
  ["Spotify", "21.90", "0.00", 12, "Active", "Entertainment", "Plano individual"],
  ["Notebook", "6000.00", "2000.00", 10, "Active", "Shopping", "12 parcelas"],
  ["Geladeira", "3600.00", "3600.00", 15, "Inactive", "Shopping", null],
  ["Passagem aérea", "1200.00", "0.00", 20, "Once", "Transport", "Compra única"],
  ["Academia", "129.90", "0.00", 8, "ToCancel", "Healthcare", "Cancelar no próximo ciclo"],
  ["Revista digital", "39.90", "39.90", 25, "Canceled", "Entertainment", null],
  ["Curso online", "900.00", "300.00", 3, "Active", "Shopping", null],
];

function build(input: CreditExpenseInput, id: string, requireActiveAccount: boolean) {
  const account = accountFor(input.accountId);
  if (!account || (requireActiveAccount && !account.active))
    throw mockApiError("invalid_account", "Conta inválida", 422, "accountId");
  const category = input.categoryId ? categoryFor(input.categoryId) : uncategorized();
  if (!category) throw mockApiError("not_found", "Categoria não encontrada", 404, "categoryId");
  return { id, account, category };
}

function validateValues(total: string, paid: string, day: number, status: string, name?: string) {
  if (name !== undefined && !name.trim())
    throw mockApiError("validation_error", "Informe o nome", 422, "name");
  if (typeof total !== "string" || !DECIMAL.test(total) || toCents(total) <= 0n)
    throw mockApiError("invalid_amount", "Valor inválido", 422, "totalAmount");
  if (typeof paid !== "string" || !DECIMAL.test(paid) || toCents(paid) > toCents(total))
    throw mockApiError("invalid_paid_amount", "Valor pago inválido", 422, "paidAmount");
  if (!Number.isInteger(day) || day < 1 || day > 31)
    throw mockApiError("invalid_day", "Dia inválido", 422, "recurrencyDay");
  if (!statuses.includes(status as CreditExpenseStatus))
    throw mockApiError("invalid_status", "Status inválido", 422, "status");
}

const seedAccount = () => listMockAccounts()[0];
let items: CreditExpense[] = seedRows.map(
  ([name, total, paid, day, status, categoryKey, notes], index) => {
    const account = seedAccount();
    const category = categoryByKey(categoryKey) ?? uncategorized();
    if (!account || !category)
      throw new Error("Dados iniciais do mock de cartão estão incompletos");
    return {
      id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      accountId: account.id,
      categoryId: category.id,
      categoryName: category.name,
      name,
      totalAmount: total,
      paidAmount: paid,
      remainingAmount: remainingOf(total, paid),
      occurredAt: new Date(Date.UTC(2026, 8 - (index % 6), 20 - index, 15)).toISOString(),
      recurrencyDay: day,
      status,
      notes,
    };
  },
);

const withCurrentRelations = (item: CreditExpense): CreditExpense => ({
  ...item,
  categoryName: categoryFor(item.categoryId)?.name ?? item.categoryName,
});
const find = (id: string) => {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw mockApiError("not_found", "Despesa de cartão não encontrada", 404);
  return item;
};
const byDateDesc = (a: CreditExpense, b: CreditExpense) =>
  a.occurredAt === b.occurredAt
    ? a.id.localeCompare(b.id)
    : b.occurredAt.localeCompare(a.occurredAt);

export const creditExpensesHandlers: MockHandler[] = [
  {
    method: "GET",
    path: /^\/credit-expenses(?:\?.*)?$/,
    handle: ({ path }) => {
      const status = new URL(path, "http://mock.local").searchParams.get("status");
      if (status !== null && !statuses.includes(status as CreditExpenseStatus))
        throw mockApiError("invalid_status", "Status inválido", 422, "status");
      return items
        .filter((item) => !status || item.status === status)
        .map(withCurrentRelations)
        .sort(byDateDesc);
    },
  },
  {
    method: "POST",
    path: "/credit-expenses",
    handle: ({ body }) => {
      const input = body as CreditExpenseInput;
      const paid = input.paidAmount ?? "0.00";
      validateValues(input.totalAmount, paid, input.recurrencyDay, input.status, input.name ?? "");
      const { id, category } = build(input, crypto.randomUUID(), true);
      const item: CreditExpense = {
        id,
        accountId: input.accountId,
        categoryId: category.id,
        categoryName: category.name,
        name: input.name.trim(),
        totalAmount: normalizeAmount(input.totalAmount),
        paidAmount: normalizeAmount(paid),
        remainingAmount: remainingOf(input.totalAmount, paid),
        occurredAt: input.occurredAt,
        recurrencyDay: input.recurrencyDay,
        status: input.status,
        notes: input.notes?.trim() || null,
      };
      items = [item, ...items];
      return item;
    },
  },
  {
    method: "PATCH",
    path: /^\/credit-expenses\/[^/?]+$/,
    handle: ({ path, body }) => {
      const current = find(path.split("/")[2] ?? "");
      const input = (body ?? {}) as CreditExpenseUpdate;
      const total = input.totalAmount ?? current.totalAmount;
      const paid = input.paidAmount ?? current.paidAmount;
      validateValues(
        total,
        paid,
        input.recurrencyDay ?? current.recurrencyDay,
        input.status ?? current.status,
        input.name,
      );
      if (input.accountId !== undefined && !accountFor(input.accountId))
        throw mockApiError("invalid_account", "Conta inválida", 422, "accountId");
      const category = input.categoryId ? categoryFor(input.categoryId) : undefined;
      if (input.categoryId && !category)
        throw mockApiError("not_found", "Categoria não encontrada", 404, "categoryId");
      const { notes, ...rest } = input;
      const updated: CreditExpense = {
        ...current,
        ...rest,
        name: input.name === undefined ? current.name : input.name.trim(),
        totalAmount: normalizeAmount(total),
        paidAmount: normalizeAmount(paid),
        remainingAmount: remainingOf(total, paid),
        ...(category ? { categoryName: category.name } : {}),
        notes: notes === undefined ? current.notes : notes?.trim() || null,
      };
      items = items.map((item) => (item.id === current.id ? updated : item));
      return updated;
    },
  },
  {
    method: "DELETE",
    path: /^\/credit-expenses\/[^/?]+$/,
    handle: ({ path }) => {
      const current = find(path.split("/")[2] ?? "");
      items = items.filter((item) => item.id !== current.id);
      return undefined;
    },
  },
];

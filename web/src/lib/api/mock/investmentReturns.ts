import type { InvestmentReturn, InvestmentReturnInput, InvestmentReturnUpdate } from "../types";
import { mockApiError, type MockHandler } from "./index";
import { listMockAccounts } from "./accounts";
import { addLocalDays, localIsoDate } from "./dates";

// Amounts are strict signed decimal strings; the mock never does float arithmetic on money.
const SIGNED_DECIMAL = /^-?\d+(?:\.\d{1,2})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isZero = (value: string) => /^-?0+(?:\.0{1,2})?$/.test(value);
const withTwoDecimals = (value: string) => {
  const [integer = "0", fraction = ""] = value.split(".");
  return `${integer}.${fraction.padEnd(2, "0")}`;
};

const accountFor = (id: string) => listMockAccounts().find((item) => item.id === id);

function validAmount(value: unknown): string {
  if (typeof value !== "string" || !SIGNED_DECIMAL.test(value) || isZero(value))
    throw mockApiError("invalid_amount", "Valor inválido", 422, "amount");
  return withTwoDecimals(value);
}

function validDate(value: unknown): string {
  const date =
    typeof value === "string" && ISO_DATE.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw mockApiError("invalid_date", "Data inválida", 422, "occurredOn");
  return value as string;
}

function validAccount(id: unknown) {
  const account = typeof id === "string" ? accountFor(id) : undefined;
  if (!account) throw mockApiError("invalid_account", "Conta inválida", 422, "accountId");
  return account;
}

const idFor = (index: number) => `60000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

/** Three coherent returns, newest 5 days ago, one of them a loss. */
function seed(): InvestmentReturn[] {
  const account = listMockAccounts()[0];
  if (!account) throw new Error("Dados iniciais do mock de rendimentos estão incompletos");
  const today = new Date();
  const rows: [number, string, string | null][] = [
    [5, "42.10", "Tesouro Selic"],
    [35, "-18.50", "Queda do fundo multimercado"],
    [66, "120.00", null],
  ];
  return rows.map(([daysAgo, amount, notes], index) => ({
    id: idFor(index + 1),
    accountId: account.id,
    accountNickname: account.nickname,
    occurredOn: localIsoDate(addLocalDays(today, -daysAgo)),
    amount,
    notes,
  }));
}

let items: InvestmentReturn[] = seed();

/** Test hook: restores the seeded returns, or starts with none ("sem dados"). */
export function resetInvestmentReturnsMock(mode: "seeded" | "empty" = "seeded") {
  items = mode === "empty" ? [] : seed();
}

export const listMockInvestmentReturns = (): InvestmentReturn[] =>
  items.map((item) => ({ ...item }));

const byDateDesc = (a: InvestmentReturn, b: InvestmentReturn) =>
  a.occurredOn === b.occurredOn
    ? a.id.localeCompare(b.id)
    : b.occurredOn.localeCompare(a.occurredOn);

const find = (id: string) => {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw mockApiError("not_found", "Rendimento não encontrado", 404);
  return item;
};

export const investmentReturnsHandlers: MockHandler[] = [
  {
    method: "GET",
    path: "/investment-returns",
    handle: () => {
      const sorted = [...items].sort(byDateDesc);
      return { items: sorted, lastDate: sorted[0]?.occurredOn ?? null };
    },
  },
  {
    method: "POST",
    path: "/investment-returns",
    handle: ({ body }) => {
      const input = (body ?? {}) as InvestmentReturnInput;
      const amount = validAmount(input.amount);
      const occurredOn = validDate(input.occurredOn);
      const account = validAccount(input.accountId);
      const item: InvestmentReturn = {
        id: crypto.randomUUID(),
        accountId: account.id,
        accountNickname: account.nickname,
        occurredOn,
        amount,
        notes: input.notes?.trim() || null,
      };
      items = [item, ...items];
      return item;
    },
  },
  {
    method: "PATCH",
    path: /^\/investment-returns\/[^/?]+$/,
    handle: ({ path, body }) => {
      const current = find(path.split("/")[2] ?? "");
      const input = (body ?? {}) as InvestmentReturnUpdate;
      const account = input.accountId === undefined ? undefined : validAccount(input.accountId);
      const { notes } = input;
      const updated: InvestmentReturn = {
        ...current,
        amount: input.amount === undefined ? current.amount : validAmount(input.amount),
        occurredOn:
          input.occurredOn === undefined ? current.occurredOn : validDate(input.occurredOn),
        ...(account ? { accountId: account.id, accountNickname: account.nickname } : {}),
        notes: notes === undefined ? current.notes : notes?.trim() || null,
      };
      items = items.map((item) => (item.id === current.id ? updated : item));
      return updated;
    },
  },
  {
    method: "DELETE",
    path: /^\/investment-returns\/[^/?]+$/,
    handle: ({ path }) => {
      const current = find(path.split("/")[2] ?? "");
      items = items.filter((item) => item.id !== current.id);
      return undefined;
    },
  },
];

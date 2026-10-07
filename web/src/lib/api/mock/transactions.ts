import type {
  PageSize,
  PaymentMethod,
  Transaction,
  TransactionInput,
  TransactionSummary,
  TransactionUpdate,
  TransactionsPage,
} from "../types";
import { mockApiError, type MockHandler } from "./index";
import { listMockAccounts } from "./accounts";
import { listMockCategories } from "./categories";
import { registerTransactionCategoryRelations } from "./transactionRelations";

const seedCategoryKeys = [
  "Entertainment",
  "Food",
  "Salaries",
  "Healthcare",
  "Transport",
  "Bills",
  "Uncategorized",
  "Shopping",
];
const names = [
  "Supermercado",
  "Restaurante",
  "Energia elétrica",
  "Internet",
  "Farmácia",
  "Combustível",
  "Salário",
  "Mensalidade",
  "Transferência",
  "Material de escritório",
];
const methods: PaymentMethod[] = [
  "PIX",
  "DebitCard",
  "Boleto",
  "BankTransfer",
  "Cash",
  "NuPay",
  "CreditCard",
  "Other",
];

let transactions: Transaction[] = Array.from({ length: 120 }, (_, index) => {
  const accounts = listMockAccounts();
  const categories = listMockCategories().filter((category) =>
    seedCategoryKeys.includes(category.key ?? ""),
  );
  const account = accounts[index % accounts.length];
  const category = categories[index % categories.length];
  const salaryCategory = categories.find((item) => item.key === "Salaries");
  const name = names[index % names.length];
  const paymentMethod = methods[index % methods.length];
  if (!account || !category || !salaryCategory || !name || !paymentMethod)
    throw new Error("Dados iniciais do mock de transações estão incompletos");
  const income = index % 13 === 6;
  const date = new Date(Date.UTC(2026, 9 - (index % 6), 24 - (index % 22), 12, index % 60));
  return {
    id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    accountId: account.id,
    accountNickname: account.nickname,
    categoryId: income ? salaryCategory.id : category.id,
    categoryName: income ? salaryCategory.name : category.name,
    name: income ? "Salário mensal" : name,
    type: income ? "Income" : "Expense",
    occurredAt: date.toISOString(),
    amount: income
      ? `${4500 + index}.00`
      : `${20 + ((index * 37) % 900)}.${String(index % 100).padStart(2, "0")}`,
    paymentMethod,
    notes: index % 5 === 0 ? "Pagamento mensal" : null,
    receipt: null,
    description:
      index % 4 === 0
        ? `${name.toUpperCase()} - COMPRA ${String(index + 1).padStart(3, "0")}`
        : null,
    // like the rows the import creates: some have the bank's identifier, the manual ones do not
    identifier:
      index % 3 === 0 ? `5e1f0c3a-7b2d-4c9e-8a10-${String(index + 1).padStart(12, "0")}` : null,
    neutral: index % 17 === 0,
    counterpartyDocument: null,
    counterpartyBank: null,
  };
});

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
const validAmount = (value: string) => /^(?:0*[1-9]\d*)(?:\.\d{1,2})?$/.test(value);
const validReceipt = (value?: string | null) => !value || /^https?:\/\//i.test(value);
const accountFor = (id: string) => listMockAccounts().find((item) => item.id === id);
const categoryFor = (id: string) => listMockCategories().find((item) => item.id === id);
const uncategorized = () => listMockCategories().find((item) => item.key === "Uncategorized");
const withCurrentRelations = (item: Transaction): Transaction => {
  const account = accountFor(item.accountId);
  const category = categoryFor(item.categoryId);
  return {
    ...item,
    accountNickname: account?.nickname ?? item.accountNickname,
    categoryName: category?.name ?? item.categoryName,
  };
};
const localDate = (iso: string) => {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const PAGE_SIZES: readonly PageSize[] = [25, 50, 100];
/** Like the API: only the exact text 25, 50 or 100; absent means 50; anything else is a 422 on `pageSize`. */
function validPageSize(query: URLSearchParams): PageSize {
  if (!query.has("pageSize")) return 50;
  const size = PAGE_SIZES.find((candidate) => String(candidate) === query.get("pageSize"));
  if (size === undefined)
    throw mockApiError("validation_error", "pageSize deve ser 25, 50 ou 100", 422, "pageSize");
  return size;
}
/** The rows the list filters select (the summary takes the same ones); sort and paging are not filters. */
const filterTransactions = (query: URLSearchParams): Transaction[] =>
  transactions.map(withCurrentRelations).filter((item) => {
    const occurredOn = localDate(item.occurredAt);
    return (
      (!query.get("from") || occurredOn >= String(query.get("from"))) &&
      (!query.get("to") || occurredOn <= String(query.get("to"))) &&
      (!query.get("accountId") || item.accountId === query.get("accountId")) &&
      (!query.get("categoryId") || item.categoryId === query.get("categoryId")) &&
      (!query.get("type") || item.type === query.get("type")) &&
      (!query.get("neutral") || String(item.neutral) === query.get("neutral")) &&
      (!query.get("q") || normalize(item.name).includes(normalize(String(query.get("q")))))
    );
  });

/** Integer cents of a mock amount ("10", "10.5" or "10.50"): money never goes through a float. */
const toCents = (amount: string): bigint => {
  const [integer = "0", fraction = ""] = amount.split(".");
  return BigInt(integer) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
};
const fromCents = (cents: bigint): string => {
  const abs = cents < 0n ? -cents : cents;
  return `${cents < 0n ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
};
/** The dashboard rules of the API (rules.ts) over the rows: neutral, CreditCard, future-dated, Investments, Reversal. */
function summarize(rows: Transaction[]): TransactionSummary {
  const now = Date.now();
  let income = 0n;
  let expense = 0n;
  let investments = 0n;
  for (const row of rows) {
    const key = categoryFor(row.categoryId)?.key;
    const countable =
      !row.neutral &&
      row.paymentMethod !== "CreditCard" &&
      new Date(row.occurredAt).getTime() <= now;
    if (!countable) continue;
    const cents = toCents(row.amount);
    if (key === "Investments") investments += row.type === "Expense" ? cents : -cents;
    else if (row.type === "Expense") expense += cents;
    else if (key === "Reversal") expense -= cents;
    else income += cents;
  }
  return {
    count: rows.length,
    income: fromCents(income),
    expense: fromCents(expense),
    investments: fromCents(investments),
    balance: fromCents(income - expense),
  };
}
const find = (id: string) => {
  const item = transactions.find((candidate) => candidate.id === id);
  if (!item) throw mockApiError("not_found", "Transação não encontrada", 404);
  return item;
};
function validate(input: TransactionInput | TransactionUpdate, requireActiveAccount = false) {
  if (input.amount !== undefined && !validAmount(input.amount))
    throw mockApiError("invalid_amount", "Valor inválido", 422, "amount");
  if (input.accountId !== undefined) {
    const account = accountFor(input.accountId);
    if (!account || (requireActiveAccount && !account.active))
      throw mockApiError("invalid_account", "Conta inválida", 422, "accountId");
  }
  if (input.categoryId !== undefined && !categoryFor(input.categoryId))
    throw mockApiError("not_found", "Categoria não encontrada", 404, "categoryId");
  if (!validReceipt(input.receipt))
    throw mockApiError("invalid_receipt_url", "URL inválida", 422, "receipt");
}
// The API accepts `description` only on creation, so the create body carries it beside the input.
type CreateInput = TransactionInput & { description?: string | null };
function hydrate(input: CreateInput, id = crypto.randomUUID()): Transaction {
  validate(input, true);
  const account = accountFor(input.accountId);
  if (!account) throw mockApiError("invalid_account", "Conta inválida", 422, "accountId");
  const category = input.categoryId ? categoryFor(input.categoryId) : uncategorized();
  if (!category) throw mockApiError("not_found", "Categoria não encontrada", 404, "categoryId");
  return {
    id,
    accountId: account.id,
    accountNickname: account.nickname,
    categoryId: category.id,
    categoryName: category.name,
    name: input.name.trim(),
    type: input.type,
    occurredAt: input.occurredAt,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    notes: input.notes?.trim() || null,
    receipt: input.receipt?.trim() || null,
    description: input.description?.trim() || null,
    // read-only: the API ignores an identifier sent on create, so a created row never has one
    identifier: null,
    neutral: input.neutral ?? false,
    counterpartyDocument: null,
    counterpartyBank: null,
  };
}

export const transactionsHandlers: MockHandler[] = [
  {
    method: "GET",
    path: /^\/transactions(?:\?.*)?$/,
    handle: ({ path }) => {
      const query = new URL(path, "http://mock.local").searchParams;
      const pageSize = validPageSize(query);
      let items = filterTransactions(query);
      const sort = query.get("sort") ?? "date";
      const direction = query.get("order") === "asc" ? 1 : -1;
      items = [...items].sort((a, b) => {
        const av =
          sort === "name"
            ? normalize(a.name)
            : sort === "category"
              ? normalize(a.categoryName)
              : sort === "amount"
                ? a.amount.padStart(24, "0")
                : a.occurredAt;
        const bv =
          sort === "name"
            ? normalize(b.name)
            : sort === "category"
              ? normalize(b.categoryName)
              : sort === "amount"
                ? b.amount.padStart(24, "0")
                : b.occurredAt;
        return av === bv ? a.id.localeCompare(b.id) : av.localeCompare(bv) * direction;
      });
      const page = Math.max(1, Number(query.get("page") ?? 1));
      return {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total: items.length,
        page,
        pageSize,
      } satisfies TransactionsPage;
    },
  },
  {
    method: "GET",
    path: /^\/transactions\/summary(?:\?.*)?$/,
    handle: ({ path }) =>
      summarize(filterTransactions(new URL(path, "http://mock.local").searchParams)),
  },
  {
    method: "POST",
    path: "/transactions",
    handle: ({ body }) => {
      const item = hydrate(body as CreateInput);
      transactions = [item, ...transactions];
      return item;
    },
  },
  {
    method: "PATCH",
    path: "/transactions/category",
    handle: ({ body }) => {
      const { ids, categoryId } = body as { ids: string[]; categoryId: string };
      const category = categoryFor(categoryId);
      if (!category || ids.some((id) => !transactions.some((item) => item.id === id)))
        throw mockApiError("not_found", "Transação ou categoria não encontrada", 404);
      transactions = transactions.map((item) =>
        ids.includes(item.id)
          ? { ...item, categoryId: category.id, categoryName: category.name }
          : item,
      );
      return undefined;
    },
  },
  {
    method: "PATCH",
    path: /^\/transactions\/[^/?]+$/,
    handle: ({ path, body }) => {
      const current = find(path.split("/")[2] ?? "");
      const input = body as TransactionUpdate;
      validate(input);
      const account = input.accountId ? accountFor(input.accountId) : undefined;
      const category = input.categoryId ? categoryFor(input.categoryId) : undefined;
      // `description` and `identifier` are read-only: the API ignores them on PATCH, and so does the mock.
      const {
        description: _description,
        identifier: _identifier,
        ...editable
      } = input as TransactionUpdate & { description?: unknown; identifier?: unknown };
      const updated = {
        ...current,
        ...editable,
        ...(account ? { accountNickname: account.nickname } : {}),
        ...(category ? { categoryName: category.name } : {}),
        notes: input.notes === undefined ? current.notes : input.notes?.trim() || null,
        receipt: input.receipt === undefined ? current.receipt : input.receipt?.trim() || null,
      };
      transactions = transactions.map((item) => (item.id === current.id ? updated : item));
      return updated;
    },
  },
  {
    method: "DELETE",
    path: /^\/transactions\/[^/?]+$/,
    handle: ({ path }) => {
      const current = find(path.split("/")[2] ?? "");
      transactions = transactions.filter((item) => item.id !== current.id);
      return undefined;
    },
  },
];

registerTransactionCategoryRelations({
  hasTransactions: (categoryId) => transactions.some((item) => item.categoryId === categoryId),
  reassignTransactions: (fromCategoryId, toCategoryId) => {
    const destination = categoryFor(toCategoryId);
    if (!destination) throw mockApiError("not_found", "Categoria não encontrada", 404);
    transactions = transactions.map((item) =>
      item.categoryId === fromCategoryId
        ? { ...item, categoryId: destination.id, categoryName: destination.name }
        : item,
    );
  },
});

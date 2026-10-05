import type {
  PaymentMethod,
  Transaction,
  TransactionInput,
  TransactionUpdate,
  TransactionsPage,
} from "../types";
import { mockApiError, type MockHandler } from "./index";

const accounts = [
  { id: "11111111-1111-4111-8111-111111111111", nickname: "Nubank pessoal", active: true },
  { id: "22222222-2222-4222-8222-222222222222", nickname: "Nubank PJ", active: true },
];
const categories = [
  ["30000000-0000-4000-8000-000000000001", "Entretenimento"],
  ["30000000-0000-4000-8000-000000000002", "Alimentação"],
  ["30000000-0000-4000-8000-000000000003", "Salários"],
  ["30000000-0000-4000-8000-000000000004", "Saúde"],
  ["30000000-0000-4000-8000-000000000007", "Transporte"],
  ["30000000-0000-4000-8000-000000000010", "Contas"],
  ["30000000-0000-4000-8000-000000000012", "Sem categoria"],
  ["30000000-0000-4000-8000-000000000015", "Compras"],
] as const;
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
];

let transactions: Transaction[] = Array.from({ length: 120 }, (_, index) => {
  const account = accounts[index % accounts.length]!;
  const category = categories[index % categories.length]!;
  const salaryCategory = categories[2]!;
  const name = names[index % names.length]!;
  const paymentMethod = methods[index % methods.length]!;
  const income = index % 13 === 6;
  const date = new Date(Date.UTC(2026, 9 - (index % 6), 24 - (index % 22), 12, index % 60));
  return {
    id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    accountId: account.id,
    accountNickname: account.nickname,
    categoryId: income ? salaryCategory[0] : category[0],
    categoryName: income ? salaryCategory[1] : category[1],
    name: income ? "Salário mensal" : name,
    type: income ? "Income" : "Expense",
    occurredAt: date.toISOString(),
    amount: income
      ? `${4500 + index}.00`
      : `${20 + ((index * 37) % 900)}.${String(index % 100).padStart(2, "0")}`,
    paymentMethod,
    notes: index % 5 === 0 ? "Pagamento mensal" : null,
    receipt: null,
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
const validReceipt = (value?: string) => !value || /^https?:\/\//i.test(value);
const accountFor = (id: string) => accounts.find((item) => item.id === id);
const categoryFor = (id?: string) => categories.find((item) => item[0] === id) ?? categories[6];
const find = (id: string) => {
  const item = transactions.find((candidate) => candidate.id === id);
  if (!item) throw mockApiError("not_found", "Transação não encontrada", 404);
  return item;
};
function validate(input: TransactionInput | TransactionUpdate) {
  if (input.amount !== undefined && !validAmount(input.amount))
    throw mockApiError("invalid_amount", "Valor inválido", 422, "amount");
  if (input.accountId !== undefined && !accountFor(input.accountId))
    throw mockApiError("invalid_account", "Conta inválida", 422, "accountId");
  if (!validReceipt(input.receipt))
    throw mockApiError("invalid_receipt_url", "URL inválida", 422, "receipt");
}
function hydrate(input: TransactionInput, id = crypto.randomUUID()): Transaction {
  validate(input);
  const account = accountFor(input.accountId);
  if (!account) throw mockApiError("invalid_account", "Conta inválida", 422, "accountId");
  const category = categoryFor(input.categoryId);
  return {
    id,
    accountId: account.id,
    accountNickname: account.nickname,
    categoryId: category[0],
    categoryName: category[1],
    name: input.name.trim(),
    type: input.type,
    occurredAt: input.occurredAt,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    notes: input.notes?.trim() || null,
    receipt: input.receipt?.trim() || null,
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
      let items = transactions.filter((item) => {
        const localDate = item.occurredAt.slice(0, 10);
        return (
          (!query.get("from") || localDate >= String(query.get("from"))) &&
          (!query.get("to") || localDate <= String(query.get("to"))) &&
          (!query.get("accountId") || item.accountId === query.get("accountId")) &&
          (!query.get("categoryId") || item.categoryId === query.get("categoryId")) &&
          (!query.get("type") || item.type === query.get("type")) &&
          (!query.get("neutral") || String(item.neutral) === query.get("neutral")) &&
          (!query.get("q") || normalize(item.name).includes(normalize(String(query.get("q")))))
        );
      });
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
        items: items.slice((page - 1) * 50, page * 50),
        total: items.length,
        page,
        pageSize: 50,
      } satisfies TransactionsPage;
    },
  },
  {
    method: "POST",
    path: "/transactions",
    handle: ({ body }) => {
      const item = hydrate(body as TransactionInput);
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
      if (
        !categories.some((item) => item[0] === categoryId) ||
        ids.some((id) => !transactions.some((item) => item.id === id))
      )
        throw mockApiError("not_found", "Transação ou categoria não encontrada", 404);
      transactions = transactions.map((item) =>
        ids.includes(item.id)
          ? { ...item, categoryId: category[0], categoryName: category[1] }
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
      const updated = {
        ...current,
        ...input,
        ...(account ? { accountNickname: account.nickname } : {}),
        ...(category ? { categoryName: category[1] } : {}),
        notes: input.notes === undefined ? current.notes : input.notes.trim() || null,
        receipt: input.receipt === undefined ? current.receipt : input.receipt.trim() || null,
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

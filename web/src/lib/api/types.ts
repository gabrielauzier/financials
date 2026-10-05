export type Money = string;

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    field?: string;
  };
};

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export type Bank = "Nubank" | "SofisaDireto" | "Neon" | "XP" | "Other";

export type Account = {
  id: string;
  bank: Bank;
  nickname: string;
  holderNames: string[];
  active: boolean;
  createdAt: string;
};

export type AccountInput = Pick<Account, "bank" | "nickname" | "holderNames">;
export type AccountUpdate = Partial<AccountInput>;

export type Category = {
  id: string;
  key: string | null;
  name: string;
  isSystem: boolean;
};

export type TransactionType = "Income" | "Expense";
export type PaymentMethod =
  "BankTransfer" | "Boleto" | "Cash" | "CreditCard" | "DebitCard" | "NuPay" | "PIX";

export type Transaction = {
  id: string;
  accountId: string;
  accountNickname: string;
  categoryId: string;
  categoryName: string;
  name: string;
  type: TransactionType;
  occurredAt: string;
  amount: Money;
  paymentMethod: PaymentMethod;
  notes: string | null;
  receipt: string | null;
  neutral: boolean;
  counterpartyDocument: string | null;
  counterpartyBank: string | null;
};

export type TransactionFilters = {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  neutral?: boolean;
  q?: string;
  sort?: "date" | "name" | "amount" | "category";
  order?: "asc" | "desc";
  page?: number;
};

export type TransactionsPage = {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: 50;
};

export type TransactionInput = {
  name: string;
  type: TransactionType;
  occurredAt: string;
  amount: Money;
  accountId: string;
  categoryId?: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  receipt?: string;
  neutral?: boolean;
};

export type TransactionUpdate = Partial<TransactionInput> & { neutral?: boolean };

export type ImportRowStatus = "new" | "duplicate" | "ignored" | "unrecognized" | "invalid";
export type ImportPaymentMethod = "PIX" | "DebitCard" | "BankTransfer" | "CreditCard";

export type PreviewRow = {
  index: number;
  localDate: string;
  type: TransactionType;
  amount: string;
  name: string;
  paymentMethod: ImportPaymentMethod;
  categoryName: string;
  status: ImportRowStatus;
  neutral: boolean;
  reason?: string;
  counterpartyDocument: string | null;
  counterpartyBank: string | null;
};

export type ImportPreview = {
  rows: PreviewRow[];
  totals: Record<ImportRowStatus, number>;
};

export type ImportSelection = { index: number; neutral: boolean };

export type ImportConfirmResult = { batchId: string; imported: number; skipped: number };

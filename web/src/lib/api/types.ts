import type { ColorKey } from "@/features/colors/palette";

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
  color: ColorKey;
  createdAt: string;
};

export type AccountInput = Pick<Account, "bank" | "nickname" | "holderNames"> & {
  color?: ColorKey;
};
export type AccountUpdate = Partial<AccountInput>;

export type Category = {
  id: string;
  key: string | null;
  name: string;
  isSystem: boolean;
  color: ColorKey;
};

export type CategoryInput = { name: string; color?: ColorKey };
export type CategoryUpdate = { name?: string; color?: ColorKey };

export type TransactionType = "Income" | "Expense";
export type PaymentMethod =
  "BankTransfer" | "Boleto" | "Cash" | "CreditCard" | "DebitCard" | "NuPay" | "PIX" | "Other";

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
  /** Original title (e.g. from the bank statement); read-only, so not in the input or update types. */
  description: string | null;
  /** External identifier set by the import; read-only, so not in the input or update types. */
  identifier: string | null;
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
  /** Rows per page; the API default is 50, so the web omits it at 50. */
  pageSize?: PageSize;
};

/** Rows per page the list accepts. */
export type PageSize = 25 | 50 | 100;

export type TransactionsPage = {
  items: Transaction[];
  total: number;
  page: number;
  /** The size the API used for this response. */
  pageSize: PageSize;
};

/** Filters of the summary: exactly the list filters, with no sort, order, page or page size. */
export type TransactionSummaryFilters = Omit<
  TransactionFilters,
  "sort" | "order" | "page" | "pageSize"
>;

/** Totals of the filtered rows, computed by the API with the dashboard rules; money is never summed in the web. */
export type TransactionSummary = {
  /** Every row the filter matches (the list total). */
  count: number;
  income: Money;
  expense: Money;
  /** Net invested (contributions minus redemptions), outside income, expense and balance. */
  investments: Money;
  balance: Money;
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

// `null` clears notes or receipt; an omitted field is left unchanged.
export type TransactionUpdate = Partial<Omit<TransactionInput, "notes" | "receipt">> & {
  neutral?: boolean;
  notes?: string | null;
  receipt?: string | null;
};

export type ImportRowStatus = "new" | "duplicate" | "ignored" | "unrecognized" | "invalid";
export type ImportPaymentMethod = PaymentMethod;

export type PreviewRow = {
  index: number;
  localDate: string;
  type: TransactionType;
  amount: string;
  name: string;
  paymentMethod: ImportPaymentMethod;
  categoryId: string;
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

export type ImportSelection = { index: number; neutral: boolean; categoryId?: string };

/** One item of `GET /imports`: a stored import file and its batch counts. */
export type ImportedFile = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  bank: string;
  account: { id: string; nickname: string };
  createdAt: string;
  rowCount: number;
  importedCount: number;
  skippedCount: number;
};

export type ImportConfirmResult = { batchId: string; imported: number; skipped: number };

export type CreditExpenseStatus = "Once" | "Active" | "Inactive" | "Canceled" | "ToCancel";

export type CreditExpense = {
  id: string;
  accountId: string;
  categoryId: string;
  categoryName: string;
  name: string;
  totalAmount: Money;
  paidAmount: Money;
  remainingAmount: Money;
  occurredAt: string;
  recurrencyDay: number;
  status: CreditExpenseStatus;
  notes: string | null;
};

export type CreditExpenseFilters = { status?: CreditExpenseStatus | undefined };

export type CreditExpenseInput = {
  name: string;
  totalAmount: Money;
  paidAmount?: Money;
  occurredAt: string;
  recurrencyDay: number;
  status: CreditExpenseStatus;
  accountId: string;
  categoryId?: string;
  notes?: string;
};

// `null` clears notes; an omitted field is left unchanged.
export type CreditExpenseUpdate = Partial<Omit<CreditExpenseInput, "notes">> & {
  notes?: string | null;
};

export type Last30Days = { total: Money; previousTotal: Money; changePct: number | null };

export type TrendPoint = { month: string; income: Money; expense: Money; balance: Money };
/** `totals` are the API's own sum of the points of the period shown (never added up in the front). */
export type TrendTotals = { income: Money; expense: Money; balance: Money };
export type Trend = { points: TrendPoint[]; totals: TrendTotals };

/** `color` is a palette key (`orange-400`). `values` has an entry per listed category for every month. */
export type ExpenseTrendCategory = { categoryId: string; name: string; color: string };
export type ExpenseTrend = {
  months: string[];
  categories: ExpenseTrendCategory[];
  points: { month: string; values: Record<string, Money> }[];
};

/** `points` run from the first month with a match to the current one; `total` and `count` cover them all. */
export type ExpenseSearch = {
  points: { month: string; total: Money }[];
  total: Money;
  count: number;
};

export type CategoryTotal = { categoryId: string; name: string; total: Money };
export type CategoryDistribution = { items: CategoryTotal[] };

export type NetWorth = { current: Money; series: { month: string; value: Money }[] };

export type CardView = {
  transactions: { categoryName: string; total: Money }[];
  creditExpenses: { categoryName: string; remaining: Money }[];
};

export type DashboardPeriod = { from: string; to: string };

/** Years with countable transactions, newest first. */
export type DashboardYears = { years: number[] };

export type InvestmentReturn = {
  id: string;
  accountId: string;
  accountNickname: string;
  occurredOn: string;
  amount: Money;
  notes: string | null;
};

export type InvestmentReturns = { items: InvestmentReturn[]; lastDate: string | null };

export type InvestmentReturnInput = {
  occurredOn: string;
  amount: Money;
  accountId: string;
  notes?: string;
};

// `null` clears notes; an omitted field is left unchanged.
export type InvestmentReturnUpdate = Partial<Omit<InvestmentReturnInput, "notes">> & {
  notes?: string | null;
};

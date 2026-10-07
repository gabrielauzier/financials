import { apiRequest } from "@/lib/api/client";
import type {
  Transaction,
  TransactionFilters,
  TransactionInput,
  TransactionsPage,
  TransactionSummary,
  TransactionSummaryFilters,
  TransactionUpdate,
} from "@/lib/api/types";

const queryString = (filters: TransactionFilters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
};
export const getTransactions = (filters: TransactionFilters) =>
  apiRequest<TransactionsPage>(`/transactions?${queryString(filters)}`);
/** Totals of the rows the filters select; the path has no `?` when no filter is active. */
export const getTransactionSummary = (filters: TransactionSummaryFilters) => {
  const query = queryString(filters);
  return apiRequest<TransactionSummary>(`/transactions/summary${query ? `?${query}` : ""}`);
};
export const createTransaction = (input: TransactionInput) =>
  apiRequest<Transaction>("/transactions", { method: "POST", body: input });
export const updateTransaction = ({ id, input }: { id: string; input: TransactionUpdate }) =>
  apiRequest<Transaction>(`/transactions/${id}`, { method: "PATCH", body: input });
export const deleteTransaction = (id: string) =>
  apiRequest<void>(`/transactions/${id}`, { method: "DELETE" });
export const updateTransactionCategories = (input: { ids: string[]; categoryId: string }) =>
  apiRequest<void>("/transactions/category", { method: "PATCH", body: input });

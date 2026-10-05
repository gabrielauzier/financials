import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Transaction,
  TransactionFilters,
  TransactionsPage,
  TransactionUpdate,
} from "@/lib/api/types";
import {
  createTransaction,
  deleteTransaction,
  getTransactions,
  updateTransaction,
  updateTransactionCategories,
} from "./api";

export const transactionsQueryOptions = (filters: TransactionFilters) =>
  queryOptions({ queryKey: ["transactions", filters], queryFn: () => getTransactions(filters) });

export function useTransactions(filters: TransactionFilters) {
  return useQuery(transactionsQueryOptions(filters));
}

const replaceInPages = (
  page: TransactionsPage | undefined,
  updater: (item: Transaction) => Transaction,
) => (page ? { ...page, items: page.items.map(updater) } : page);

export function useCreateTransaction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => client.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export function useDeleteTransaction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => client.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export function useUpdateTransaction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateTransaction,
    onMutate: async ({ id, input }) => {
      await client.cancelQueries({ queryKey: ["transactions"] });
      const previous = client.getQueriesData<TransactionsPage>({ queryKey: ["transactions"] });
      client.setQueriesData<TransactionsPage>({ queryKey: ["transactions"] }, (page) =>
        replaceInPages(page, (item) => (item.id === id ? { ...item, ...input } : item)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) =>
      context?.previous.forEach(([key, value]) => client.setQueryData(key, value)),
    onSettled: () => client.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export function useUpdateTransactionCategories() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateTransactionCategories,
    onSuccess: () => client.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export type UpdateTransactionVariables = { id: string; input: TransactionUpdate };

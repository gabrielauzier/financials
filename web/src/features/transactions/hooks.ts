import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
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
  getTransactionSummary,
  updateTransaction,
  updateTransactionCategories,
} from "./api";
import { summaryFilters } from "./utils";

export const transactionsQueryOptions = (filters: TransactionFilters) =>
  queryOptions({ queryKey: ["transactions", filters], queryFn: () => getTransactions(filters) });

export function useTransactions(filters: TransactionFilters, enabled = true) {
  return useQuery({ ...transactionsQueryOptions(filters), enabled });
}

/**
 * The summary key is outside the ["transactions"] prefix on purpose: the optimistic update of that prefix assumes
 * every entry is a page of rows. The key holds only the filters, so a page, sort or size change reuses it.
 */
export const transactionSummaryQueryOptions = (filters: TransactionFilters) => {
  const onlyFilters = summaryFilters(filters);
  return queryOptions({
    queryKey: ["transaction-summary", onlyFilters],
    queryFn: () => getTransactionSummary(onlyFilters),
  });
};

export function useTransactionSummary(filters: TransactionFilters, enabled = true) {
  return useQuery({ ...transactionSummaryQueryOptions(filters), enabled });
}

/** Any change to the transactions changes the summary too, so both are refetched. */
const invalidateTransactions = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: ["transactions"] }),
    client.invalidateQueries({ queryKey: ["transaction-summary"] }),
  ]);

const replaceInPages = (
  page: TransactionsPage | undefined,
  updater: (item: Transaction) => Transaction,
) => (page ? { ...page, items: page.items.map(updater) } : page);

export function useCreateTransaction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => invalidateTransactions(client),
  });
}

export function useDeleteTransaction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => invalidateTransactions(client),
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
    onSettled: () => invalidateTransactions(client),
  });
}

export function useUpdateTransactionCategories() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateTransactionCategories,
    onSuccess: () => invalidateTransactions(client),
  });
}

export type UpdateTransactionVariables = { id: string; input: TransactionUpdate };

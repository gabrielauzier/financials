import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreditExpense, CreditExpenseFilters, CreditExpenseUpdate } from "@/lib/api/types";
import {
  createCreditExpense,
  deleteCreditExpense,
  getCreditExpenses,
  updateCreditExpense,
} from "./api";

export const creditExpensesQueryOptions = (filters: CreditExpenseFilters) =>
  queryOptions({
    queryKey: ["creditExpenses", { status: filters.status }],
    queryFn: () => getCreditExpenses(filters),
  });

export function useCreditExpenses(filters: CreditExpenseFilters) {
  return useQuery(creditExpensesQueryOptions(filters));
}

export function useCreateCreditExpense() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createCreditExpense,
    onSuccess: () => client.invalidateQueries({ queryKey: ["creditExpenses"] }),
  });
}

export function useDeleteCreditExpense() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteCreditExpense,
    onSuccess: () => client.invalidateQueries({ queryKey: ["creditExpenses"] }),
  });
}

export function useUpdateCreditExpense() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateCreditExpense,
    onMutate: async ({ id, input }) => {
      await client.cancelQueries({ queryKey: ["creditExpenses"] });
      const previous = client.getQueriesData<CreditExpense[]>({ queryKey: ["creditExpenses"] });
      client.setQueriesData<CreditExpense[]>({ queryKey: ["creditExpenses"] }, (items) =>
        items?.map((item) => {
          if (item.id !== id) return item;
          const { notes, ...rest } = input;
          return { ...item, ...rest, ...(notes === undefined ? {} : { notes }) };
        }),
      );
      return { previous };
    },
    onError: (_error, _variables, context) =>
      context?.previous.forEach(([key, value]) => client.setQueryData(key, value)),
    onSettled: () => client.invalidateQueries({ queryKey: ["creditExpenses"] }),
  });
}

export type UpdateCreditExpenseVariables = { id: string; input: CreditExpenseUpdate };

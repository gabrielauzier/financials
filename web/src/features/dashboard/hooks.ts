import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DashboardPeriod, InvestmentReturns, InvestmentReturnUpdate } from "@/lib/api/types";
import {
  createInvestmentReturn,
  deleteInvestmentReturn,
  getCardView,
  getCategoryDistribution,
  getInvestmentReturns,
  getLast30Days,
  getNetWorth,
  getTrend,
  getYears,
  updateInvestmentReturn,
} from "./api";

export const NET_WORTH_KEY = ["dashboard", "net-worth"] as const;

export const last30DaysQueryOptions = () =>
  queryOptions({ queryKey: ["dashboard", "last-30-days"], queryFn: getLast30Days });
export const trendQueryOptions = () =>
  queryOptions({ queryKey: ["dashboard", "trend"], queryFn: getTrend });
export const netWorthQueryOptions = () =>
  queryOptions({ queryKey: NET_WORTH_KEY, queryFn: getNetWorth });

export const useLast30Days = () => useQuery(last30DaysQueryOptions());
export const useTrend = () => useQuery(trendQueryOptions());
/** Years with transactions for the month/year select and the year shortcuts; `enabled` skips the request. */
export const useYears = (enabled = true) =>
  useQuery({ queryKey: ["dashboard", "years"], queryFn: getYears, enabled });
export const useNetWorth = () => useQuery(netWorthQueryOptions());

/** `period` null (custom range incomplete or invalid) disables the query. */
export const useCategoryDistribution = (period: DashboardPeriod | null) =>
  useQuery({
    queryKey: ["dashboard", "categories", period],
    queryFn: () => getCategoryDistribution(period as DashboardPeriod),
    enabled: period !== null,
  });

export const useCardView = (period: DashboardPeriod | null) =>
  useQuery({
    queryKey: ["dashboard", "card", period],
    queryFn: () => getCardView(period as DashboardPeriod),
    enabled: period !== null,
  });

export const INVESTMENT_RETURNS_KEY = ["investmentReturns"] as const;

export const investmentReturnsQueryOptions = () =>
  queryOptions({ queryKey: INVESTMENT_RETURNS_KEY, queryFn: getInvestmentReturns });

export const useInvestmentReturns = () => useQuery(investmentReturnsQueryOptions());

const invalidateNetWorth = (client: ReturnType<typeof useQueryClient>) =>
  client.invalidateQueries({ queryKey: NET_WORTH_KEY });

export function useCreateInvestmentReturn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createInvestmentReturn,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: INVESTMENT_RETURNS_KEY }),
        invalidateNetWorth(client),
      ]),
  });
}

export function useDeleteInvestmentReturn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteInvestmentReturn,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: INVESTMENT_RETURNS_KEY }),
        invalidateNetWorth(client),
      ]),
  });
}

export function useUpdateInvestmentReturn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateInvestmentReturn,
    onMutate: async ({ id, input }) => {
      await client.cancelQueries({ queryKey: INVESTMENT_RETURNS_KEY });
      const previous = client.getQueriesData<InvestmentReturns>({
        queryKey: INVESTMENT_RETURNS_KEY,
      });
      client.setQueriesData<InvestmentReturns>(
        { queryKey: INVESTMENT_RETURNS_KEY },
        (list) =>
          list && {
            ...list,
            items: list.items.map((item) => {
              if (item.id !== id) return item;
              const { notes, ...rest } = input;
              return { ...item, ...rest, ...(notes === undefined ? {} : { notes }) };
            }),
          },
      );
      return { previous };
    },
    onError: (_error, _variables, context) =>
      context?.previous.forEach(([key, value]) => client.setQueryData(key, value)),
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: INVESTMENT_RETURNS_KEY }),
        invalidateNetWorth(client),
      ]),
  });
}

export type UpdateInvestmentReturnVariables = { id: string; input: InvestmentReturnUpdate };

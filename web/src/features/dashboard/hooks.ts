import { queryOptions, useQuery } from "@tanstack/react-query";
import type { DashboardPeriod } from "@/lib/api/types";
import { getCardView, getCategoryDistribution, getLast30Days, getNetWorth, getTrend } from "./api";

export const NET_WORTH_KEY = ["dashboard", "net-worth"] as const;

export const last30DaysQueryOptions = () =>
  queryOptions({ queryKey: ["dashboard", "last-30-days"], queryFn: getLast30Days });
export const trendQueryOptions = () =>
  queryOptions({ queryKey: ["dashboard", "trend"], queryFn: getTrend });
export const netWorthQueryOptions = () =>
  queryOptions({ queryKey: NET_WORTH_KEY, queryFn: getNetWorth });

export const useLast30Days = () => useQuery(last30DaysQueryOptions());
export const useTrend = () => useQuery(trendQueryOptions());
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

import { apiRequest } from "@/lib/api/client";
import type {
  CardView,
  CategoryDistribution,
  DashboardPeriod,
  DashboardYears,
  InvestmentReturn,
  InvestmentReturnInput,
  InvestmentReturns,
  InvestmentReturnUpdate,
  Last30Days,
  NetWorth,
  Trend,
} from "@/lib/api/types";

const periodQuery = ({ from, to }: DashboardPeriod) =>
  `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

export const getLast30Days = () => apiRequest<Last30Days>("/dashboard/last-30-days");
export const getTrend = () => apiRequest<Trend>("/dashboard/trend");
export const getCategoryDistribution = (period: DashboardPeriod) =>
  apiRequest<CategoryDistribution>(`/dashboard/categories${periodQuery(period)}`);
export const getYears = () => apiRequest<DashboardYears>("/dashboard/years");
export const getNetWorth = () => apiRequest<NetWorth>("/dashboard/net-worth");
export const getCardView = (period: DashboardPeriod) =>
  apiRequest<CardView>(`/dashboard/card${periodQuery(period)}`);

export const getInvestmentReturns = () => apiRequest<InvestmentReturns>("/investment-returns");
export const createInvestmentReturn = (input: InvestmentReturnInput) =>
  apiRequest<InvestmentReturn>("/investment-returns", { method: "POST", body: input });
export const updateInvestmentReturn = ({
  id,
  input,
}: {
  id: string;
  input: InvestmentReturnUpdate;
}) => apiRequest<InvestmentReturn>(`/investment-returns/${id}`, { method: "PATCH", body: input });
export const deleteInvestmentReturn = (id: string) =>
  apiRequest<void>(`/investment-returns/${id}`, { method: "DELETE" });

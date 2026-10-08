import { apiRequest } from "@/lib/api/client";
import type {
  CardView,
  CategoryDistribution,
  DashboardPeriod,
  DashboardYears,
  ExpenseSearch,
  ExpenseTrend,
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
/** No period: the API answers the rolling last 12 months. */
export const getTrend = (period?: DashboardPeriod) =>
  apiRequest<Trend>(`/dashboard/trend${period ? periodQuery(period) : ""}`);
export const getCategoryDistribution = (period: DashboardPeriod) =>
  apiRequest<CategoryDistribution>(`/dashboard/categories${periodQuery(period)}`);
export const getExpenseTrend = (period?: DashboardPeriod) =>
  apiRequest<ExpenseTrend>(`/dashboard/expense-trend${period ? periodQuery(period) : ""}`);
export const getExpenseSearch = (q: string) =>
  apiRequest<ExpenseSearch>(`/dashboard/expense-search?q=${encodeURIComponent(q)}`);
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

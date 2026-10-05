import { apiRequest } from "@/lib/api/client";
import type {
  CreditExpense,
  CreditExpenseFilters,
  CreditExpenseInput,
  CreditExpenseUpdate,
} from "@/lib/api/types";

export const getCreditExpenses = ({ status }: CreditExpenseFilters) =>
  apiRequest<CreditExpense[]>(
    status ? `/credit-expenses?status=${encodeURIComponent(status)}` : "/credit-expenses",
  );
export const createCreditExpense = (input: CreditExpenseInput) =>
  apiRequest<CreditExpense>("/credit-expenses", { method: "POST", body: input });
export const updateCreditExpense = ({ id, input }: { id: string; input: CreditExpenseUpdate }) =>
  apiRequest<CreditExpense>(`/credit-expenses/${id}`, { method: "PATCH", body: input });
export const deleteCreditExpense = (id: string) =>
  apiRequest<void>(`/credit-expenses/${id}`, { method: "DELETE" });

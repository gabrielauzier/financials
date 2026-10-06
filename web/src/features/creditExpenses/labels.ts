import type { CreditExpenseStatus } from "@/lib/api/types";

export const creditExpenseStatusLabels: Record<CreditExpenseStatus, string> = {
  Once: "Única (inativa na próxima fatura)",
  Active: "Ativa (recorre até quitar)",
  Inactive: "Inativa",
  Canceled: "Cancelada",
  ToCancel: "A cancelar",
};

export const creditExpenseStatuses = Object.keys(
  creditExpenseStatusLabels,
) as CreditExpenseStatus[];

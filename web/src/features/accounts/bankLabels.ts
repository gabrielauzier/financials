import type { Bank } from "@/lib/api/types";

/** Portuguese label of each bank, shared by the icon, the list and the form. */
export const bankLabels: Record<Bank, string> = {
  Nubank: "Nubank",
  SofisaDireto: "Sofisa Direto",
  Neon: "Neon",
  XP: "XP",
  Other: "Outro",
};

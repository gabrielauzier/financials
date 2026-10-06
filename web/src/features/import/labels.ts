import type { ImportRowStatus } from "@/lib/api/types";

export const importStatusLabels: Record<ImportRowStatus, string> = {
  new: "Nova",
  duplicate: "Duplicada",
  ignored: "Ignorada",
  unrecognized: "Não reconhecida",
  invalid: "Inválida",
};

/** `YYYY-MM-DD` to `dd/mm/aaaa` by splitting the string, never through `Date` (timezone shift). */
export function formatLocalDate(localDate: string): string {
  const [year, month, day] = localDate.split("-");
  return year && month && day ? `${day}/${month}/${year}` : localDate;
}

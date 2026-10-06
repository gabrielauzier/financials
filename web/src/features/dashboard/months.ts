const ABBREVIATIONS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** "2026-10" -> "out/26" (pt-BR, no Date so the browser time zone cannot shift the month). */
export function formatMonth(month: string): string {
  const [year = "", mm = ""] = month.split("-");
  const name = ABBREVIATIONS[Number(mm) - 1];
  return name ? `${name}/${year.slice(-2)}` : month;
}

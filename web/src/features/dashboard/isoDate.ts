/** "2026-10-05" -> "05/10/2026", without Date so the time zone cannot shift the day. */
export function formatIsoDate(iso: string): string {
  const [year = "", month = "", day = ""] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Whole calendar days from the `iso` date (YYYY-MM-DD) to the local "today". */
export function daysSince(iso: string, now = new Date()): number {
  const [year = 0, month = 1, day = 1] = iso.split("-").map(Number);
  const then = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - then) / 86_400_000);
}

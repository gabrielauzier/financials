const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` to a local-midnight Date, or undefined when it is not a real calendar day. Never parses the string with `Date`. */
export function parseLocalDate(value: string): Date | undefined {
  const match = ISO_DAY.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  // `new Date(y, m, d)` rolls over (and maps years 0-99 to 19xx): accept only the exact same day back.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined;
  }
  return date;
}

/** Local Date to `YYYY-MM-DD` with the local getters (no `toISOString`, so no time zone shift). */
export function formatLocalDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Trims the ends and collapses runs of whitespace into one space; keeps case and accents. */
export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Comparison key: no accents, lowercase, collapsed spaces, trimmed. */
export function normalizeName(value: string): string {
  return collapseSpaces(value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase());
}

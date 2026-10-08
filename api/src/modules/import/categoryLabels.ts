import { normalizeName } from '../../lib/normalize.js';
import type { ParsedRow } from './types.js';

/** A category of the user as `analyze` reads it; `key` is null for categories the user created. */
export interface UserCategory {
  id: string;
  key: string | null;
  name: string;
}

/** Owner-defined aliases: file label (letters only, `normalizeName`) to the system key it maps to. */
const ALIASES: Readonly<Record<string, string>> = {
  needed: 'Emergency',
  leo: 'Pets',
};

/** The label without emoji or punctuation, so `Leo 😺` compares as `leo`. */
function lettersOnly(label: string): string {
  return normalizeName(label.replace(/[^\p{L}\p{N}\s]/gu, ''));
}

/**
 * Resolves a category text of a file against the user's categories, in order: the system `key`
 * (case-insensitive), the pt-BR name (accent- and case-insensitive; user-created categories
 * included), the owner alias. Returns null when nothing matches (a blank label never reaches here).
 */
export function resolveCategoryLabel(label: string, categories: UserCategory[]): UserCategory | null {
  const lower = label.trim().toLowerCase();
  const byKey = categories.find((c) => c.key !== null && c.key.toLowerCase() === lower);
  if (byKey) return byKey;
  const normalized = normalizeName(label);
  const byName = categories.find((c) => normalizeName(c.name) === normalized);
  if (byName) return byName;
  const aliasKey = ALIASES[lettersOnly(label)];
  return aliasKey === undefined ? null : (categories.find((c) => c.key === aliasKey) ?? null);
}

/**
 * Applies `resolveCategoryLabel` to the importable rows that carry a category label: sets
 * `resolvedCategory`; a label with no match leaves the default category and marks the row
 * `unrecognized` (reason `Categoria "X" não encontrada`, appended to any other reason). A neutral
 * row (`neutralHint`) in the `Reversal` category is an Income, any other neutral row an Expense.
 * A blank label keeps the parser's default. Rows without a label, `ignored` and `invalid` rows
 * are returned untouched.
 */
export function applyCategoryLabels(rows: ParsedRow[], categories: UserCategory[]): ParsedRow[] {
  return rows.map((row) => {
    const label = row.categoryLabel?.trim() ?? '';
    if (label === '' || (row.status !== 'new' && row.status !== 'unrecognized')) return row;
    const found = resolveCategoryLabel(label, categories);
    if (found === null) {
      const reason = `Categoria "${label}" não encontrada`;
      return { ...row, status: 'unrecognized', reason: row.reason === undefined ? reason : `${row.reason}; ${reason}` };
    }
    const type = row.neutralHint === true && found.key === 'Reversal' ? 'Income' : row.type;
    return { ...row, type, resolvedCategory: { id: found.id, name: found.name } };
  });
}

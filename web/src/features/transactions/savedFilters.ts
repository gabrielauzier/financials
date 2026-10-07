import { sanitizeSavedState, type SavedFilterState } from "./savedFilterState";

export const SAVED_FILTERS_VERSION = 1;
export const MAX_SAVED_FILTERS = 20;
export const MAX_FILTER_NAME_LENGTH = 40;
const KEY_PREFIX = "financials:transactions:saved-filters:";
const MAX_ID_LENGTH = 64;

/** The key of one user's filters: the same browser can hold several users, and none sees another's. */
export const savedFiltersKey = (userId: string) => `${KEY_PREFIX}${userId}`;

export type SavedFilter = { id: string; name: string; state: SavedFilterState };
export type SavedFilterFailure =
  "invalid-name" | "duplicate-name" | "limit" | "not-found" | "storage";
export type SavedFilterResult =
  { ok: true; filter?: SavedFilter } | { ok: false; reason: SavedFilterFailure; message: string };
type Failure = Extract<SavedFilterResult, { ok: false }>;

export const FILTER_MESSAGES = {
  nameRequired: "Informe um nome para o filtro",
  nameTooLong: `O nome deve ter no máximo ${MAX_FILTER_NAME_LENGTH} caracteres`,
  duplicate: "Já existe um filtro salvo com esse nome",
  limit: `Limite de ${MAX_SAVED_FILTERS} filtros salvos atingido. Exclua um para salvar outro.`,
  storage:
    "Não foi possível acessar o armazenamento do navegador. Verifique se ele está liberado e tente de novo.",
  notFound: "Esse filtro não existe mais",
} as const;

const failure = (reason: SavedFilterFailure, message: string): Failure => ({
  ok: false,
  reason,
  message,
});

/** Name used to compare two names: no accents, lower case, one space between words, trimmed. */
export function normalizeFilterName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

/** The trimmed name when it has 1 to 40 characters, else `undefined`. */
const trimmedName = (name: string): string | undefined => {
  const trimmed = name.trim();
  const length = [...trimmed].length;
  return length >= 1 && length <= MAX_FILTER_NAME_LENGTH ? trimmed : undefined;
};

/** Checks a name against the rules and the other filters; the first rule that fails is the message. */
function checkName(
  name: string,
  others: readonly SavedFilter[],
): { ok: true; name: string } | Failure {
  const trimmed = name.trim();
  if (trimmed === "") return failure("invalid-name", FILTER_MESSAGES.nameRequired);
  if (trimmedName(trimmed) === undefined) {
    return failure("invalid-name", FILTER_MESSAGES.nameTooLong);
  }
  const key = normalizeFilterName(trimmed);
  if (others.some((other) => normalizeFilterName(other.name) === key)) {
    return failure("duplicate-name", FILTER_MESSAGES.duplicate);
  }
  return { ok: true, name: trimmed };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Everything that can be read from a stored text, validated; whatever is wrong is left out, never thrown. */
function parseStored(text: string | null): SavedFilter[] {
  if (text === null) return [];
  let stored: unknown;
  try {
    stored = JSON.parse(text);
  } catch {
    return [];
  }
  if (!isRecord(stored) || stored["version"] !== SAVED_FILTERS_VERSION) return [];
  const entries = stored["filters"];
  if (!Array.isArray(entries)) return [];
  const filters: SavedFilter[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const entry of entries) {
    if (filters.length >= MAX_SAVED_FILTERS) break;
    if (!isRecord(entry)) continue;
    const { id, name } = entry;
    if (typeof id !== "string" || id === "" || id.length > MAX_ID_LENGTH) continue;
    const valid = typeof name === "string" ? trimmedName(name) : undefined;
    if (valid === undefined) continue;
    const key = normalizeFilterName(valid);
    if (ids.has(id) || names.has(key)) continue;
    ids.add(id);
    names.add(key);
    filters.push({ id, name: valid, state: sanitizeSavedState(entry["state"]) });
  }
  return filters;
}

type Loaded = { available: boolean; filters: SavedFilter[] };
const UNAVAILABLE: Loaded = { available: false, filters: [] };

function load(userId: string): Loaded {
  if (userId === "") return UNAVAILABLE;
  try {
    return { available: true, filters: parseStored(localStorage.getItem(savedFiltersKey(userId))) };
  } catch {
    return UNAVAILABLE;
  }
}

function save(userId: string, filters: readonly SavedFilter[]): boolean {
  try {
    const stored = {
      version: SAVED_FILTERS_VERSION,
      filters: filters.map(({ id, name, state }) => ({ id, name, state })),
    };
    localStorage.setItem(savedFiltersKey(userId), JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

/** The user's saved filters, validated; `available` is false when the browser storage cannot be read. */
export function readSavedFilters(userId: string): Loaded {
  return load(userId);
}

/** Alphabetical by name, ignoring case and accent; equal names stay in the stored order. */
export function sortSavedFilters(filters: readonly SavedFilter[]): SavedFilter[] {
  return [...filters].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
  );
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Reads the storage fresh (another tab may have written), applies `change` and writes. A storage that cannot
 * be read is never written over, and one that cannot be written leaves the list as it was.
 */
function mutate(
  userId: string,
  change: (filters: SavedFilter[]) => { filters: SavedFilter[]; filter?: SavedFilter } | Failure,
): SavedFilterResult {
  const current = load(userId);
  if (!current.available) return failure("storage", FILTER_MESSAGES.storage);
  const outcome = change(current.filters);
  if ("ok" in outcome) return outcome;
  if (!save(userId, outcome.filters)) return failure("storage", FILTER_MESSAGES.storage);
  return outcome.filter ? { ok: true, filter: outcome.filter } : { ok: true };
}

export function addSavedFilter(
  userId: string,
  name: string,
  state: SavedFilterState,
): SavedFilterResult {
  return mutate(userId, (filters) => {
    const checked = checkName(name, filters);
    if (!checked.ok) return checked;
    if (filters.length >= MAX_SAVED_FILTERS) return failure("limit", FILTER_MESSAGES.limit);
    const filter = { id: newId(), name: checked.name, state: sanitizeSavedState(state) };
    return { filters: [...filters, filter], filter };
  });
}

export function renameSavedFilter(userId: string, id: string, name: string): SavedFilterResult {
  return mutate(userId, (filters) => {
    const target = filters.find((filter) => filter.id === id);
    if (!target) return failure("not-found", FILTER_MESSAGES.notFound);
    const checked = checkName(
      name,
      filters.filter((filter) => filter.id !== id),
    );
    if (!checked.ok) return checked;
    const filter = { ...target, name: checked.name };
    return { filters: filters.map((item) => (item.id === id ? filter : item)), filter };
  });
}

export function deleteSavedFilter(userId: string, id: string): SavedFilterResult {
  return mutate(userId, (filters) => {
    if (!filters.some((filter) => filter.id === id)) {
      return failure("not-found", FILTER_MESSAGES.notFound);
    }
    return { filters: filters.filter((filter) => filter.id !== id) };
  });
}

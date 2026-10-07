import { useCallback, useMemo, useState } from "react";
import type { SavedFilterState } from "./savedFilterState";
import {
  addSavedFilter,
  deleteSavedFilter,
  MAX_SAVED_FILTERS,
  readSavedFilters,
  renameSavedFilter,
  sortSavedFilters,
  type SavedFilterResult,
} from "./savedFilters";

/**
 * The saved filters of a user, alphabetical, with the actions. The list is read from the storage for the
 * current user and read again after every action, so it never drifts from what is stored. Without a user
 * (`null`) it is empty, unavailable, and every action fails like an unreadable storage.
 */
export function useSavedFilters(userId: string | null) {
  const owner = userId ?? "";
  const [version, setVersion] = useState(0);
  const { available, filters } = useMemo(() => {
    const read = readSavedFilters(owner);
    return { available: read.available, filters: sortSavedFilters(read.filters) };
    // `version` is not read inside: it is the signal that the storage changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, version]);
  const reread = useCallback((result: SavedFilterResult) => {
    setVersion((current) => current + 1);
    return result;
  }, []);
  const add = useCallback(
    (name: string, state: SavedFilterState) => reread(addSavedFilter(owner, name, state)),
    [owner, reread],
  );
  const rename = useCallback(
    (id: string, name: string) => reread(renameSavedFilter(owner, id, name)),
    [owner, reread],
  );
  const remove = useCallback((id: string) => reread(deleteSavedFilter(owner, id)), [owner, reread]);
  return { filters, available, atLimit: filters.length >= MAX_SAVED_FILTERS, add, rename, remove };
}

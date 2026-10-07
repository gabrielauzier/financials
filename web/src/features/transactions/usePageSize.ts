import { useCallback, useState } from "react";
import type { PageSize } from "@/lib/api/types";

/** The sizes the API accepts, in the order the select lists them. */
export const PAGE_SIZES: readonly PageSize[] = [25, 50, 100];
export const DEFAULT_PAGE_SIZE: PageSize = 50;
export const PAGE_SIZE_STORAGE_KEY = "financials:transactions:page-size";

/**
 * The size saved in the browser: only the exact text 25, 50 or 100 counts. Anything else (nothing saved, another
 * text, an unreadable `localStorage`, no `localStorage` at all on the server) gives the default, never an error.
 */
export function readStoredPageSize(): PageSize {
  try {
    const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    return PAGE_SIZES.find((size) => String(size) === stored) ?? DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

/** The rows-per-page choice, kept in `localStorage`; a failed write still changes the size for this session. */
export function usePageSize(): readonly [PageSize, (size: PageSize) => void] {
  const [pageSize, setState] = useState<PageSize>(readStoredPageSize);
  const setPageSize = useCallback((size: PageSize) => {
    setState(size);
    try {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size));
    } catch {
      // blocked or full storage: the choice only lasts until the page is reloaded
    }
  }, []);
  return [pageSize, setPageSize] as const;
}

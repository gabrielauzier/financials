/** An entry of the page bar: a page number or the gap between two shown pages. */
export type PageEntry = number | "…";

/** Pages shown at most; with more pages than this the bar keeps exactly this many entries. */
const MAX_ENTRIES = 7;

/**
 * Entries of the page bar for `current` of `total` pages. Up to 7 pages all show; with more, the bar always
 * has 7 entries so it does not change width while navigating: the first and last pages, the current one with
 * its neighbors, and "…" for the gaps (near either end the run reaches 5 pages, so a gap never hides a single page).
 * A `total` below 1 counts as 1; a `current` outside 1..total gives the run of the nearest end.
 */
export function pageNumbers(current: number, total: number): PageEntry[] {
  const last = Math.max(1, total);
  if (last <= MAX_ENTRIES) return Array.from({ length: last }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", last];
  if (current >= last - 3) return [1, "…", last - 4, last - 3, last - 2, last - 1, last];
  return [1, "…", current - 1, current, current + 1, "…", last];
}

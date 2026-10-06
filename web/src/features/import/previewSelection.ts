import type { ImportRowStatus, ImportSelection, PreviewRow } from "@/lib/api/types";

export type RowChoice = { selected: boolean; neutral: boolean; categoryId: string };
/** Per-row user choices, keyed by the row index returned by the preview. */
export type PreviewSelection = Record<number, RowChoice>;

/** The row's choice; a row missing from `selection` falls back to what the preview sent. */
export const choiceOf = (row: PreviewRow, selection: PreviewSelection): RowChoice =>
  selection[row.index] ?? { selected: false, neutral: row.neutral, categoryId: row.categoryId };

/** Ignored and invalid rows can never be imported. */
export const isSelectable = (status: ImportRowStatus) =>
  status !== "ignored" && status !== "invalid";

/** New and unrecognized rows start selected; duplicates start unselected (but selectable). */
export function initialSelection(rows: PreviewRow[]): PreviewSelection {
  const selection: PreviewSelection = {};
  for (const row of rows) {
    selection[row.index] = {
      selected: row.status === "new" || row.status === "unrecognized",
      neutral: row.neutral,
      categoryId: row.categoryId,
    };
  }
  return selection;
}

/** The `selections` payload of the confirm request: only selected, selectable rows. */
export function selectedPayload(
  rows: PreviewRow[],
  selection: PreviewSelection,
): ImportSelection[] {
  return rows
    .filter((row) => isSelectable(row.status) && selection[row.index]?.selected)
    .map((row) => ({
      index: row.index,
      neutral: selection[row.index]?.neutral ?? row.neutral,
      categoryId: selection[row.index]?.categoryId ?? row.categoryId,
    }));
}

export type SelectAllState = "all" | "some" | "none" | "disabled";

/** State of the header checkbox, computed over the selectable rows only. */
export function selectAllState(rows: PreviewRow[], selection: PreviewSelection): SelectAllState {
  const selectable = rows.filter((row) => isSelectable(row.status));
  if (selectable.length === 0) return "disabled";
  const selected = selectable.filter((row) => selection[row.index]?.selected).length;
  if (selected === 0) return "none";
  return selected === selectable.length ? "all" : "some";
}

/** Marks or clears every selectable row; neutral flags and ignored/invalid rows are left alone. */
export function setAllSelected(
  rows: PreviewRow[],
  selection: PreviewSelection,
  selected: boolean,
): PreviewSelection {
  const next: PreviewSelection = { ...selection };
  for (const row of rows) {
    if (!isSelectable(row.status)) continue;
    next[row.index] = { ...choiceOf(row, selection), selected };
  }
  return next;
}

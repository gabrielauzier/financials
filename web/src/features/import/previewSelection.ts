import type { ImportRowStatus, ImportSelection, PreviewRow } from "@/lib/api/types";

export type RowChoice = { selected: boolean; neutral: boolean };
/** Per-row user choices, keyed by the row index returned by the preview. */
export type PreviewSelection = Record<number, RowChoice>;

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
    .map((row) => ({ index: row.index, neutral: selection[row.index]?.neutral ?? row.neutral }));
}

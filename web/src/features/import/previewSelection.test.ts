import { describe, expect, it } from "vitest";
import type { ImportRowStatus, PreviewRow } from "@/lib/api/types";
import {
  initialSelection,
  isSelectable,
  selectAllState,
  setAllSelected,
  type PreviewSelection,
} from "./previewSelection";

const row = (
  index: number,
  status: ImportRowStatus,
  extra: Partial<PreviewRow> = {},
): PreviewRow => ({
  index,
  localDate: "2026-03-05",
  type: "Expense",
  amount: "10.00",
  name: `Linha ${index}`,
  paymentMethod: "PIX",
  categoryName: "Sem categoria",
  status,
  neutral: false,
  counterpartyDocument: null,
  counterpartyBank: null,
  ...extra,
});

const rows: PreviewRow[] = [
  row(0, "new"),
  row(1, "duplicate"),
  row(2, "ignored"),
  row(3, "unrecognized", { neutral: true }),
  row(4, "invalid"),
];

describe("selecionar todas: estado do checkbox (IMPIMP-04)", () => {
  it("a seleção inicial marca novas e não reconhecidas e deixa duplicadas desmarcadas", () => {
    const selection = initialSelection(rows);
    expect(selection[0]?.selected).toBe(true);
    expect(selection[1]?.selected).toBe(false);
    expect(selection[3]?.selected).toBe(true);
  });

  it("é parcial quando apenas parte das linhas selecionáveis está marcada", () => {
    expect(selectAllState(rows, initialSelection(rows))).toBe("some");
  });

  it("é total quando todas as linhas selecionáveis estão marcadas, mesmo com ignoradas e inválidas desmarcadas", () => {
    const all = setAllSelected(rows, initialSelection(rows), true);
    expect(selectAllState(rows, all)).toBe("all");
    expect(all[2]?.selected).toBe(false);
    expect(all[4]?.selected).toBe(false);
  });

  it("é nenhuma quando nenhuma linha selecionável está marcada", () => {
    expect(selectAllState(rows, setAllSelected(rows, initialSelection(rows), false))).toBe("none");
    expect(selectAllState(rows, {})).toBe("none");
  });

  it("fica desabilitado quando só há linhas ignoradas e inválidas", () => {
    const blocked = [row(0, "ignored"), row(1, "invalid")];
    expect(selectAllState(blocked, initialSelection(blocked))).toBe("disabled");
    expect(selectAllState([], {})).toBe("disabled");
  });

  it("uma linha selecionável presente na seleção mas desmarcada mantém o estado parcial", () => {
    const two = [row(0, "new"), row(1, "new")];
    expect(selectAllState(two, { 0: { selected: true, neutral: false } })).toBe("some");
  });
});

describe("selecionar todas: aplicar (IMPIMP-04)", () => {
  it("marca só as linhas selecionáveis e nunca as ignoradas nem as inválidas", () => {
    const next = setAllSelected(rows, initialSelection(rows), true);
    expect(rows.filter((r) => next[r.index]?.selected).map((r) => r.index)).toEqual([0, 1, 3]);
    expect(rows.filter((r) => isSelectable(r.status)).map((r) => r.index)).toEqual([0, 1, 3]);
  });

  it("limpa todas as linhas selecionáveis", () => {
    const next = setAllSelected(rows, initialSelection(rows), false);
    expect(rows.some((r) => next[r.index]?.selected)).toBe(false);
  });

  it("mantém a chave Neutra de cada linha, inclusive a que o usuário alterou", () => {
    const start: PreviewSelection = {
      ...initialSelection(rows),
      0: { selected: true, neutral: true },
      3: { selected: true, neutral: false },
    };
    for (const selected of [true, false]) {
      const next = setAllSelected(rows, start, selected);
      expect(next[0]?.neutral).toBe(true);
      expect(next[1]?.neutral).toBe(false);
      expect(next[3]?.neutral).toBe(false);
    }
  });

  it("usa o neutral do preview para a linha ausente da seleção", () => {
    const next = setAllSelected(rows, {}, true);
    expect(next[3]).toEqual({ selected: true, neutral: true });
  });

  it("não altera o objeto de seleção recebido", () => {
    const start = initialSelection(rows);
    const snapshot = JSON.stringify(start);
    setAllSelected(rows, start, true);
    expect(JSON.stringify(start)).toBe(snapshot);
  });
});

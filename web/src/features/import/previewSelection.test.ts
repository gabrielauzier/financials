import { describe, expect, it } from "vitest";
import type { ImportRowStatus, PreviewRow } from "@/lib/api/types";
import {
  initialSelection,
  isSelectable,
  selectedDuplicateCount,
  selectedPayload,
  selectAllState,
  setAllSelected,
  type PreviewSelection,
} from "./previewSelection";

const UNCATEGORIZED = "30000000-0000-4000-8000-000000000012";
const FOOD = "30000000-0000-4000-8000-000000000002";

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
  categoryId: UNCATEGORIZED,
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
    expect(
      selectAllState(two, { 0: { selected: true, neutral: false, categoryId: UNCATEGORIZED } }),
    ).toBe("some");
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
      0: { selected: true, neutral: true, categoryId: UNCATEGORIZED },
      3: { selected: true, neutral: false, categoryId: UNCATEGORIZED },
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
    expect(next[3]).toEqual({ selected: true, neutral: true, categoryId: UNCATEGORIZED });
  });

  it("não altera o objeto de seleção recebido", () => {
    const start = initialSelection(rows);
    const snapshot = JSON.stringify(start);
    setAllSelected(rows, start, true);
    expect(JSON.stringify(start)).toBe(snapshot);
  });
});

describe("categoria por linha no estado e no payload (IMPIMP-03)", () => {
  const catRows: PreviewRow[] = [
    row(0, "new", { categoryId: FOOD }),
    row(1, "duplicate"),
    row(2, "ignored"),
    row(3, "invalid"),
    row(4, "unrecognized"),
  ];

  it("a seleção inicial guarda a categoryId do preview de cada linha", () => {
    const selection = initialSelection(catRows);
    expect(selection[0]?.categoryId).toBe(FOOD);
    expect(selection[1]?.categoryId).toBe(UNCATEGORIZED);
    expect(selection[4]?.categoryId).toBe(UNCATEGORIZED);
  });

  it("o payload envia { index, neutral, categoryId } com a categoria padrão do preview", () => {
    expect(selectedPayload(catRows, initialSelection(catRows))).toEqual([
      { index: 0, neutral: false, categoryId: FOOD },
      { index: 4, neutral: false, categoryId: UNCATEGORIZED },
    ]);
  });

  it("o payload envia a categoria escolhida e só para linhas selecionadas e selecionáveis", () => {
    const selection: PreviewSelection = {
      ...initialSelection(catRows),
      0: { selected: true, neutral: false, categoryId: UNCATEGORIZED },
      1: { selected: true, neutral: true, categoryId: FOOD },
      2: { selected: true, neutral: false, categoryId: FOOD },
      3: { selected: true, neutral: false, categoryId: FOOD },
    };
    expect(selectedPayload(catRows, selection)).toEqual([
      { index: 0, neutral: false, categoryId: UNCATEGORIZED },
      { index: 1, neutral: true, categoryId: FOOD },
      { index: 4, neutral: false, categoryId: UNCATEGORIZED },
    ]);
  });

  it("uma linha fora do estado de seleção não entra no payload", () => {
    expect(selectedPayload([row(7, "new", { categoryId: FOOD, neutral: true })], {})).toEqual([]);
  });
});

describe("selectedDuplicateCount (IMPIMP-06)", () => {
  const mixed: PreviewRow[] = [
    row(0, "new"),
    row(1, "duplicate"),
    row(2, "duplicate"),
    row(3, "unrecognized"),
    row(4, "duplicate"),
  ];

  it("conta só duplicadas selecionadas", () => {
    const selection: PreviewSelection = {
      ...initialSelection(mixed),
      1: { selected: true, neutral: false, categoryId: UNCATEGORIZED },
      4: { selected: true, neutral: false, categoryId: UNCATEGORIZED },
    };
    expect(selectedDuplicateCount(mixed, selection)).toBe(2);
  });

  it("novas e não reconhecidas selecionadas, e duplicadas desmarcadas, não contam", () => {
    expect(selectedDuplicateCount(mixed, initialSelection(mixed))).toBe(0);
    expect(selectedDuplicateCount(mixed, {})).toBe(0);
  });

  it("conta todas as duplicadas depois de selecionar todas", () => {
    expect(selectedDuplicateCount(mixed, setAllSelected(mixed, {}, true))).toBe(3);
  });
});

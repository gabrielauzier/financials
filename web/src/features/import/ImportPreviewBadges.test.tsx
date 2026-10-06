import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { ImportPreview, ImportRowStatus, PreviewRow } from "@/lib/api/types";
import { failures, renderWithQuery, resetSpy, responses } from "@/test/apiSpy";
import { ImportPreviewTable } from "./ImportPreviewTable";
import { initialSelection } from "./previewSelection";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
});

const FOOD = "30000000-0000-4000-8000-000000000002"; // Alimentação, orange-400
const TRANSPORT = "30000000-0000-4000-8000-000000000007"; // Transporte, blue-400
const UNKNOWN = "99999999-9999-4999-8999-999999999999";

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
  categoryId: FOOD,
  categoryName: "Alimentação",
  status,
  neutral: false,
  counterpartyDocument: null,
  counterpartyBank: null,
  ...extra,
});

const rows: PreviewRow[] = [
  row(0, "new"),
  row(1, "ignored", { categoryId: TRANSPORT, categoryName: "Nome do preview" }),
  row(2, "invalid", { categoryId: UNKNOWN, categoryName: "Categoria sumida" }),
];
const preview: ImportPreview = {
  rows,
  totals: { new: 1, duplicate: 0, ignored: 1, unrecognized: 0, invalid: 1 },
};
const renderTable = () =>
  renderWithQuery(
    <ImportPreviewTable
      preview={preview}
      selection={initialSelection(rows)}
      onSelectionChange={vi.fn()}
    />,
  );
const rowEl = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;
const categoryCell = (name: string) => within(rowEl(name)).getAllByRole("cell")[4] as HTMLElement;

describe("prévia do import: badge de categoria (COLOR-10 AC 5, 6, 8)", () => {
  it("o select da linha selecionável mostra o badge no gatilho e nas opções", async () => {
    renderTable();
    const trigger = await screen.findByRole("combobox", { name: "Categoria de Linha 0" });
    await waitFor(() => expect(trigger).toHaveTextContent("Alimentação"));
    expect(within(trigger).getByText("Alimentação")).toHaveClass(
      "bg-orange-400",
      "text-orange-800",
    );
    fireEvent.click(trigger);
    const option = await screen.findByRole("option", { name: "Transporte" });
    expect(within(option).getByText("Transporte")).toHaveClass("bg-blue-400", "text-blue-800");
  });

  it("linha ignorada ou inválida mostra o badge com o nome do preview e a cor da categoria com o mesmo id", async () => {
    renderTable();
    await waitFor(() =>
      expect(within(categoryCell("Linha 1")).getByText("Nome do preview")).toHaveClass(
        "bg-blue-400",
        "text-blue-800",
        "ring-inset",
      ),
    );
    expect(within(categoryCell("Linha 1")).queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("uma categoryId que não está na lista do usuário cai no texto do preview", async () => {
    renderTable();
    await waitFor(() =>
      expect(within(categoryCell("Linha 1")).getByText("Nome do preview")).toHaveClass(
        "bg-blue-400",
      ),
    );
    const cell = categoryCell("Linha 2");
    expect(cell).toHaveTextContent("Categoria sumida");
    expect(cell.querySelector("div")).toBeNull();
  });

  it("enquanto as categorias carregam o select diz Carregando categorias… e as outras linhas ficam em texto", () => {
    responses.set("GET /categories", () => new Promise(() => {}));
    renderTable();
    const trigger = screen.getByRole("combobox", { name: "Categoria de Linha 0" });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent("Carregando categorias…");
    expect(categoryCell("Linha 1")).toHaveTextContent("Nome do preview");
    expect(categoryCell("Linha 1").querySelector("div")).toBeNull();
  });

  it("se as categorias falham todas as linhas mostram o categoryName em texto, sem badge", async () => {
    failures.set("GET /categories", new ApiError("internal_error", "boom", 500));
    renderTable();
    await waitFor(() => expect(screen.queryAllByRole("combobox")).toHaveLength(0));
    for (const [name, text] of [
      ["Linha 0", "Alimentação"],
      ["Linha 1", "Nome do preview"],
      ["Linha 2", "Categoria sumida"],
    ] as const) {
      expect(categoryCell(name)).toHaveTextContent(text);
      expect(categoryCell(name).querySelector("div")).toBeNull();
    }
  });
});

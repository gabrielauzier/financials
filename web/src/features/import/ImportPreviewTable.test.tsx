import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImportPreview, ImportRowStatus, PreviewRow } from "@/lib/api/types";
import { ImportPreviewTable } from "./ImportPreviewTable";
import { initialSelection, selectedPayload, type PreviewSelection } from "./previewSelection";
import { formatLocalDate } from "./labels";

afterEach(cleanup);

const row = (
  index: number,
  status: ImportRowStatus,
  extra: Partial<PreviewRow> = {},
): PreviewRow => ({
  index,
  localDate: "2026-03-05",
  type: "Expense",
  amount: "1234.50",
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
  row(2, "ignored", { reason: "Pagamento recebido" }),
  row(3, "unrecognized"),
  row(4, "invalid", { reason: "Valor inválido" }),
  row(5, "new", { neutral: true, type: "Income", amount: "10.00", paymentMethod: "BankTransfer" }),
];
const preview: ImportPreview = {
  rows,
  totals: { new: 2, duplicate: 1, ignored: 1, unrecognized: 1, invalid: 1 },
};

function Harness({
  onChange,
}: {
  onChange: (payload: ReturnType<typeof selectedPayload>) => void;
}) {
  const [selection, setSelection] = useState<PreviewSelection>(() => initialSelection(rows));
  const change = (next: PreviewSelection) => {
    setSelection(next);
    onChange(selectedPayload(rows, next));
  };
  return <ImportPreviewTable preview={preview} selection={selection} onSelectionChange={change} />;
}

describe("tabela da prévia", () => {
  it("mostra as contagens, o contador e os badges em português", () => {
    render(<Harness onChange={vi.fn()} />);
    const totals = within(screen.getByRole("list", { name: "Resumo da prévia" }));
    expect(totals.getByText(/novas/)).toHaveTextContent("2 novas");
    expect(totals.getByText(/duplicadas/)).toHaveTextContent("1 duplicadas");
    expect(totals.getByText(/ignoradas/)).toHaveTextContent("1 ignoradas");
    expect(totals.getByText(/não reconhecidas/)).toHaveTextContent("1 não reconhecidas");
    expect(totals.getByText(/inválidas/)).toHaveTextContent("1 inválidas");
    expect(screen.getByText("3 linhas selecionadas")).toBeInTheDocument();
    for (const label of ["Nova", "Duplicada", "Ignorada", "Não reconhecida", "Inválida"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("Ignorada")).toHaveAttribute("title", "Pagamento recebido");
  });

  it("formata data sem deslocar o dia, valor com sinal e rótulos de método e tipo", () => {
    render(<Harness onChange={vi.fn()} />);
    expect(formatLocalDate("2026-03-05")).toBe("05/03/2026");
    const first = within(screen.getByText("Linha 0").closest("tr")!);
    expect(first.getByText("05/03/2026")).toBeInTheDocument();
    expect(first.getByText("-R$ 1.234,50")).toBeInTheDocument();
    expect(first.getByText("Despesa")).toBeInTheDocument();
    expect(first.getByText("PIX")).toBeInTheDocument();
    const income = within(screen.getByText("Linha 5").closest("tr")!);
    expect(income.getByText("R$ 10,00")).toBeInTheDocument();
    expect(income.getByText("Receita")).toBeInTheDocument();
    expect(income.getByText("Transferência bancária")).toBeInTheDocument();
  });

  it("duplicadas começam desmarcadas e podem ser marcadas e desmarcadas", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "Selecionar Linha 1" });
    expect(box).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Selecionar Linha 0" })).toBeChecked();
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([{ index: 1, neutral: false }]),
    );
    expect(screen.getByText("4 linhas selecionadas")).toBeInTheDocument();
    fireEvent.click(box);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.arrayContaining([{ index: 1, neutral: false }]),
    );
  });

  it("linhas ignoradas e inválidas não têm checkbox e nunca entram no payload", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.queryByRole("checkbox", { name: "Selecionar Linha 2" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Selecionar Linha 4" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Linha 1" }));
    const indexes = onChange.mock.calls.at(-1)![0].map((s: { index: number }) => s.index);
    expect(indexes).toEqual([0, 1, 3, 5]);
  });

  it("neutra começa na sugestão do servidor e a troca muda o payload", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const suggested = screen.getByRole("switch", { name: "Marcar Linha 5 como neutra" });
    const other = screen.getByRole("switch", { name: "Marcar Linha 0 como neutra" });
    expect(suggested).toBeChecked();
    expect(other).not.toBeChecked();
    fireEvent.click(other);
    fireEvent.click(suggested);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        { index: 0, neutral: true },
        { index: 5, neutral: false },
      ]),
    );
  });

  it("destaca linhas não reconhecidas para revisão", () => {
    render(<Harness onChange={vi.fn()} />);
    expect(screen.getAllByText("Revise esta linha")).toHaveLength(1);
    expect(screen.getByText("Linha 3").closest("tr")).toHaveAttribute(
      "data-status",
      "unrecognized",
    );
    expect(screen.getByRole("checkbox", { name: "Selecionar Linha 3" })).toBeChecked();
  });

  it("o contador vai a zero ao desmarcar tudo", () => {
    render(<Harness onChange={vi.fn()} />);
    for (const name of ["Linha 0", "Linha 3", "Linha 5"]) {
      fireEvent.click(screen.getByRole("checkbox", { name: `Selecionar ${name}` }));
    }
    expect(screen.getByText("0 linhas selecionadas")).toBeInTheDocument();
  });
});

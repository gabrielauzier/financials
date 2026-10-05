import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CreditExpense } from "@/lib/api/types";
import { CreditExpensesTable } from "./CreditExpensesTable";

afterEach(cleanup);

const expense = (overrides: Partial<CreditExpense> = {}): CreditExpense => ({
  id: "50000000-0000-4000-8000-000000000001",
  accountId: "11111111-1111-4111-8111-111111111111",
  categoryId: "30000000-0000-4000-8000-000000000012",
  categoryName: "Sem categoria",
  name: "Notebook",
  totalAmount: "600.00",
  paidAmount: "200.00",
  remainingAmount: "400.00",
  occurredAt: "2026-09-20T15:00:00.000Z",
  recurrencyDay: 10,
  status: "Active",
  notes: "12 parcelas",
  ...overrides,
});

const baseProps = {
  status: undefined,
  onStatusChange: () => {},
  onEdit: () => {},
  onDelete: () => {},
};
const tableRow = (name: string) =>
  within(screen.getByRole("table")).getByText(name).closest("tr") as HTMLElement;

describe("CreditExpensesTable", () => {
  it("shows the columns and, per row, the remaining amount next to total and paid", () => {
    render(
      <CreditExpensesTable
        {...baseProps}
        items={[
          expense(),
          expense({
            id: "2",
            name: "Geladeira",
            totalAmount: "1234.56",
            paidAmount: "34.56",
            remainingAmount: "1200.00",
            status: "ToCancel",
            notes: null,
          }),
        ]}
      />,
    );
    const headers = within(screen.getByRole("table"))
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent);
    expect(headers).toEqual([
      "Nome",
      "Categoria",
      "Valor total",
      "Valor pago",
      "Restante",
      "Dia da fatura",
      "Status",
      "Observações",
      "Ações",
    ]);
    const first = within(tableRow("Notebook"));
    expect(first.getByText("R$ 600,00")).toBeInTheDocument();
    expect(first.getByText("R$ 200,00")).toBeInTheDocument();
    expect(first.getByText("R$ 400,00")).toBeInTheDocument();
    expect(first.getByText("10")).toBeInTheDocument();
    expect(first.getByText("Ativa (recorre até quitar)")).toBeInTheDocument();
    expect(first.getByText("12 parcelas")).toBeInTheDocument();
    const second = within(tableRow("Geladeira"));
    expect(second.getByText("R$ 1.234,56")).toBeInTheDocument();
    expect(second.getByText("R$ 34,56")).toBeInTheDocument();
    expect(second.getByText("R$ 1.200,00")).toBeInTheDocument();
    expect(second.getByText("A cancelar")).toBeInTheDocument();
  });

  it("status filter offers Todos and the 5 statuses and emits the chosen one", () => {
    const onStatusChange = vi.fn();
    render(
      <CreditExpensesTable {...baseProps} items={[expense()]} onStatusChange={onStatusChange} />,
    );
    fireEvent.click(screen.getByLabelText("Status"));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Todos",
      "Única (inativa na próxima fatura)",
      "Ativa (recorre até quitar)",
      "Inativa",
      "Cancelada",
      "A cancelar",
    ]);
    fireEvent.click(screen.getByRole("option", { name: "A cancelar" }));
    expect(onStatusChange).toHaveBeenCalledWith("ToCancel");
  });

  it("choosing Todos clears the status filter", () => {
    const onStatusChange = vi.fn();
    render(
      <CreditExpensesTable
        {...baseProps}
        status="Inactive"
        items={[expense({ status: "Inactive" })]}
        onStatusChange={onStatusChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Status"));
    fireEvent.click(screen.getByRole("option", { name: "Todos" }));
    expect(onStatusChange).toHaveBeenCalledWith(undefined);
  });

  it("shows the empty state without rows", () => {
    render(<CreditExpensesTable {...baseProps} items={[]} />);
    expect(screen.getByText("Nenhuma despesa de cartão cadastrada.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows loading, and an error with a retry button instead of the empty state", () => {
    const onRetry = vi.fn();
    const { rerender } = render(<CreditExpensesTable {...baseProps} items={[]} isLoading />);
    expect(screen.getByText("Carregando despesas de cartão…")).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma despesa de cartão cadastrada.")).not.toBeInTheDocument();
    rerender(<CreditExpensesTable {...baseProps} items={[]} isError onRetry={onRetry} />);
    expect(
      screen.getByText("Não foi possível carregar as despesas de cartão."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma despesa de cartão cadastrada.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("edit and delete buttons call back with the row", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const item = expense();
    render(
      <CreditExpensesTable {...baseProps} items={[item]} onEdit={onEdit} onDelete={onDelete} />,
    );
    const row = within(tableRow("Notebook"));
    fireEvent.click(row.getByRole("button", { name: "Editar Notebook" }));
    fireEvent.click(row.getByRole("button", { name: "Excluir Notebook" }));
    expect(onEdit).toHaveBeenCalledWith(item);
    expect(onDelete).toHaveBeenCalledWith(item);
  });
});

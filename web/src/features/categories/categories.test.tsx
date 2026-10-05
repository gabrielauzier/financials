import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { CategoriesPage } from "./CategoriesPage";
import { CategorySelect } from "./CategorySelect";

function renderQuery(
  ui: ReactNode,
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
afterEach(cleanup);

describe("categorias", () => {
  it("mostra nomes em português e protege categorias de sistema", async () => {
    renderQuery(<CategoriesPage />);
    expect(await screen.findByText("Entretenimento")).toBeInTheDocument();
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Estorno (de compras)")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Renomear Sem categoria" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir Investimentos" })).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Categoria de sistema")).toHaveLength(3);
  });

  it("renomeia uma categoria comum", async () => {
    renderQuery(<CategoriesPage />);
    await screen.findByText("Desejos");
    fireEvent.click(screen.getByRole("button", { name: "Renomear Desejos" }));
    const input = screen.getByLabelText("Nome da categoria");
    fireEvent.change(input, { target: { value: "Objetivos" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(await screen.findByText("Objetivos")).toBeInTheDocument();
  });

  it("exige um destino ao excluir categoria em uso", async () => {
    renderQuery(<CategoriesPage />);
    await screen.findByText("Entretenimento");
    fireEvent.click(screen.getByRole("button", { name: "Excluir Entretenimento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Esta categoria está em uso.")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Categoria de destino"));
    fireEvent.click(await screen.findByRole("option", { name: "Alimentação" }));
    fireEvent.click(screen.getByRole("button", { name: "Mover e excluir" }));
    await waitFor(() => expect(screen.queryByText("Entretenimento")).not.toBeInTheDocument());
  });

  it("lista categorias no seletor e emite o id", async () => {
    const onChange = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(
      ["categories"],
      [
        {
          id: "30000000-0000-4000-8000-000000000004",
          key: "Healthcare",
          name: "Saúde",
          isSystem: false,
        },
      ],
    );
    renderQuery(
      <>
        <label htmlFor="test-category">Categoria</label>
        <CategorySelect id="test-category" onChange={onChange} />
      </>,
      client,
    );
    fireEvent.click(await screen.findByLabelText("Categoria"));
    fireEvent.click(await screen.findByRole("option", { name: "Saúde" }));
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^30000000/));
  });
});

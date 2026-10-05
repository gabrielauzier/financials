import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockRequest } from "@/lib/api/mock";
import type {
  Account,
  Category,
  Transaction,
  TransactionsPage as TransactionsPageData,
} from "@/lib/api/types";
import { TransactionForm } from "./TransactionForm";
import { TransactionsPage } from "./TransactionsPage";
import { parseBRLToDecimal } from "./utils";

const account: Account = {
  id: "11111111-1111-4111-8111-111111111111",
  bank: "Nubank",
  nickname: "Nubank pessoal",
  holderNames: ["Gabriel"],
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const category: Category = {
  id: "30000000-0000-4000-8000-000000000012",
  key: "Uncategorized",
  name: "Sem categoria",
  isSystem: true,
};

function renderQuery(ui: React.ReactNode, client?: QueryClient) {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("extrato", () => {
  it("converte valores brasileiros sem aritmética de ponto flutuante", () => {
    expect(parseBRLToDecimal("1.234,56")).toBe("1234.56");
    expect(parseBRLToDecimal("0,00")).toBeNull();
    expect(parseBRLToDecimal("12,345")).toBeNull();
  });

  it("mock combina filtros, busca sem acentos e pagina em 50", async () => {
    const result = await mockRequest<TransactionsPageData>({
      method: "GET",
      path: "/transactions?accountId=11111111-1111-4111-8111-111111111111&type=Expense&q=supermercado&sort=name&order=asc&page=1",
    });
    expect(result.pageSize).toBe(50);
    expect(
      result.items.every((item) => item.accountId === account.id && item.type === "Expense"),
    ).toBe(true);
    expect(
      result.items.every((item) => item.name.toLocaleLowerCase().includes("supermercado")),
    ).toBe(true);
  });

  it("mostra colunas, valores formatados e indicação de neutra", async () => {
    renderQuery(<TransactionsPage />);
    expect(await screen.findByRole("columnheader", { name: /Data/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Método de pagamento/ })).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Neutra").length).toBeGreaterThan(0);
  });

  it("alterna a ordenação pelo cabeçalho", async () => {
    renderQuery(<TransactionsPage />);
    const name = await screen.findByRole("button", { name: /Nome/ });
    fireEvent.click(name);
    await waitFor(() => expect(screen.getByText(/Página 1 de/)).toBeInTheDocument());
    fireEvent.click(name);
    expect(name).toBeEnabled();
  }, 15_000);

  it("valida campos obrigatórios, valor e URL no formulário", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    client.setQueryData(["accounts", { active: true }], [account]);
    client.setQueryData(["categories"], [category]);
    renderQuery(<TransactionForm open onOpenChange={vi.fn()} />, client);
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "10,999" } });
    fireEvent.change(screen.getByLabelText("Recibo (URL)"), { target: { value: "arquivo.pdf" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Informe o nome")).toBeInTheDocument();
    expect(screen.getByText("Valor inválido")).toBeInTheDocument();
    expect(screen.getByText("URL inválida")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Conta"));
    expect(await screen.findByRole("option", { name: "Nubank pessoal" })).toBeInTheDocument();
  });

  it("atualiza categoria em lote de forma atômica no mock", async () => {
    const page = await mockRequest<TransactionsPageData>({
      method: "GET",
      path: "/transactions?page=1",
    });
    const ids = page.items.slice(0, 2).map((item) => item.id);
    const target = "30000000-0000-4000-8000-000000000004";
    await mockRequest<void>({
      method: "PATCH",
      path: "/transactions/category",
      body: { ids, categoryId: target },
    });
    const updated = await Promise.all(
      ids.map((id) =>
        mockRequest<Transaction>({ method: "PATCH", path: `/transactions/${id}`, body: {} }),
      ),
    );
    expect(updated.every((item) => item.categoryId === target)).toBe(true);
    await expect(
      mockRequest({
        method: "PATCH",
        path: "/transactions/category",
        body: { ids: [ids[0], "inexistente"], categoryId: category.id },
      }),
    ).rejects.toMatchObject({ status: 404 });
    const unchanged = await mockRequest<Transaction>({
      method: "PATCH",
      path: `/transactions/${ids[0]}`,
      body: {},
    });
    expect(unchanged.categoryId).toBe(target);
  });
});

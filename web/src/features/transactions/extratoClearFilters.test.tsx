import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockRequest } from "@/lib/api/mock";
import type { Account, Category, TransactionsPage as Page } from "@/lib/api/types";
import { renderWithQuery, requests, resetSpy, responses } from "@/test/apiSpy";
import { pickDate } from "@/test/datePicker";
import { TransactionsPage } from "./TransactionsPage";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

// The pickers open on the month of the clock (June 2026). The timers are faked too, so the 300 ms search
// debounce that starts on mount is moved by hand: without that, a click made before it fires would see the
// page reset to 1 by it, and a test could pass or fail depending on how fast the machine is.
const NOW = new Date(2026, 5, 15, 12);
beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW }));
afterEach(() => {
  cleanup();
  resetSpy();
  vi.useRealTimers();
});

const listPaths = () =>
  requests
    .filter((request) => request.method === "GET" && request.path.startsWith("/transactions?"))
    .map((request) => request.path);
const lastList = () => listPaths().at(-1) ?? "";
/** The parameters of the last list query, so the checks do not depend on their order. */
const lastParams = () =>
  Object.fromEntries(new URLSearchParams(lastList().split("?")[1] ?? "").entries());
const clearButtons = () => screen.queryAllByRole("button", { name: /^Limpar filtro \S/ });
const clearButton = (label: string) =>
  screen.getByRole("button", { name: `Limpar filtro ${label}` });
const queryClearButton = (label: string) =>
  screen.queryByRole("button", { name: `Limpar filtro ${label}` });
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

/**
 * What the tests check is the query the page sends, not the rows. The list answers with three rows and a
 * total of 120 (three pages of 50), echoing the requested page: re-rendering 50 rows and 50 cards on every
 * filter change would take most of each test's time.
 */
const lightList = async () => {
  const rows = (await mockRequest<Page>({ method: "GET", path: "/transactions" })).items;
  responses.set("GET /transactions", () => ({
    items: rows.slice(0, 3),
    total: 120,
    page: Number(lastParams()["page"] ?? 1),
    pageSize: 50,
  }));
};
const renderLoaded = async () => {
  await lightList();
  renderWithQuery(<TransactionsPage />);
  await screen.findByText(/Página 1 de/);
  // let the debounce of the (still empty) search settle before interacting
  await advance(350);
};
const chooseOption = async (label: string, option: string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole("option", { name: option }));
};
const sortByValueAscending = async () => {
  fireEvent.click(screen.getByRole("button", { name: /Valor/ }));
  await waitFor(() => expect(lastParams()).toMatchObject({ sort: "amount", order: "asc" }));
};

const SORT = { sort: "amount", order: "asc", page: "1" };

describe("extrato: limpar cada filtro individualmente", () => {
  // One test per filter: it applies the filter and one other, sorts by value, clears only that filter and
  // expects exactly the other filter and the sort to remain, on page 1.
  it("a busca: 'Limpar filtro Busca' esvazia o campo e consulta sem q, mantendo De e a ordenação", async () => {
    await renderLoaded();
    await sortByValueAscending();
    pickDate("De", "2026-06-01");
    fireEvent.change(screen.getByLabelText("Buscar por nome"), { target: { value: "Farm" } });
    await advance(300);
    await waitFor(() => expect(lastParams()).toEqual({ ...SORT, from: "2026-06-01", q: "Farm" }));
    fireEvent.click(clearButton("Busca"));
    await waitFor(() => expect(lastParams()).toEqual({ ...SORT, from: "2026-06-01" }));
    expect(screen.getByLabelText("Buscar por nome")).toHaveValue("");
    expect(queryClearButton("Busca")).not.toBeInTheDocument();
    expect(queryClearButton("De")).toBeInTheDocument();
  });

  it("a busca não consulta uma segunda vez 300 ms depois de limpada pelo 'x'", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByLabelText("Buscar por nome"), { target: { value: "Farm" } });
    await advance(300);
    await waitFor(() => expect(lastParams()["q"]).toBe("Farm"));
    fireEvent.click(clearButton("Busca"));
    // at once, not after the 300 ms debounce: no timer has moved since the click
    expect(lastParams()["q"]).toBeUndefined();
    expect(screen.getByLabelText("Buscar por nome")).toHaveValue("");
    const after = listPaths().length;
    await advance(1000);
    expect(listPaths()).toHaveLength(after);
    expect(lastParams()["q"]).toBeUndefined();
  });

  it("o tipo: 'Limpar filtro Tipo' consulta sem type, mantendo De e a ordenação", async () => {
    await renderLoaded();
    await sortByValueAscending();
    pickDate("De", "2026-06-01");
    await chooseOption("Tipo", "Receita");
    await waitFor(() =>
      expect(lastParams()).toEqual({ ...SORT, from: "2026-06-01", type: "Income" }),
    );
    fireEvent.click(clearButton("Tipo"));
    await waitFor(() => expect(lastParams()).toEqual({ ...SORT, from: "2026-06-01" }));
    expect(screen.getByLabelText("Tipo")).toHaveTextContent("Todos");
    expect(queryClearButton("Tipo")).not.toBeInTheDocument();
    expect(queryClearButton("De")).toBeInTheDocument();
  });

  it("a conta: 'Limpar filtro Conta' consulta sem accountId, mantendo De e a ordenação", async () => {
    const [account] = await mockRequest<Account[]>({ method: "GET", path: "/accounts" });
    if (!account) throw new Error("seed");
    await renderLoaded();
    await sortByValueAscending();
    pickDate("De", "2026-06-01");
    await chooseOption("Conta", account.nickname);
    await waitFor(() =>
      expect(lastParams()).toEqual({ ...SORT, from: "2026-06-01", accountId: account.id }),
    );
    fireEvent.click(clearButton("Conta"));
    await waitFor(() => expect(lastParams()).toEqual({ ...SORT, from: "2026-06-01" }));
    expect(queryClearButton("Conta")).not.toBeInTheDocument();
    expect(queryClearButton("De")).toBeInTheDocument();
  });

  it("a categoria: 'Limpar filtro Categoria' consulta sem categoryId, mantendo De e a ordenação", async () => {
    const [category] = (
      await mockRequest<Category[]>({ method: "GET", path: "/categories" })
    ).slice(-1);
    if (!category) throw new Error("seed");
    await renderLoaded();
    await sortByValueAscending();
    pickDate("De", "2026-06-01");
    await chooseOption("Categoria", category.name);
    await waitFor(() =>
      expect(lastParams()).toEqual({ ...SORT, from: "2026-06-01", categoryId: category.id }),
    );
    fireEvent.click(clearButton("Categoria"));
    await waitFor(() => expect(lastParams()).toEqual({ ...SORT, from: "2026-06-01" }));
    expect(queryClearButton("Categoria")).not.toBeInTheDocument();
    expect(queryClearButton("De")).toBeInTheDocument();
  });

  it("a neutra: 'Limpar filtro Neutra' consulta sem neutral, mantendo De e a ordenação", async () => {
    await renderLoaded();
    await sortByValueAscending();
    pickDate("De", "2026-06-01");
    await chooseOption("Neutra", "Sim");
    await waitFor(() =>
      expect(lastParams()).toEqual({ ...SORT, from: "2026-06-01", neutral: "true" }),
    );
    fireEvent.click(clearButton("Neutra"));
    await waitFor(() => expect(lastParams()).toEqual({ ...SORT, from: "2026-06-01" }));
    expect(screen.getByLabelText("Neutra")).toHaveTextContent("Todas");
    expect(queryClearButton("Neutra")).not.toBeInTheDocument();
    expect(queryClearButton("De")).toBeInTheDocument();
  });

  it("a data inicial: 'Limpar filtro De' consulta sem from e mantém Até e a ordenação", async () => {
    await renderLoaded();
    await sortByValueAscending();
    pickDate("De", "2026-06-01");
    pickDate("Até", "2026-06-30");
    await waitFor(() =>
      expect(lastParams()).toEqual({ ...SORT, from: "2026-06-01", to: "2026-06-30" }),
    );
    fireEvent.click(clearButton("De"));
    await waitFor(() => expect(lastParams()).toEqual({ ...SORT, to: "2026-06-30" }));
    expect(screen.getByLabelText("De")).toHaveTextContent("Selecione a data");
    expect(screen.getByLabelText("Até")).toHaveTextContent("30/06/2026");
    expect(queryClearButton("De")).not.toBeInTheDocument();
    expect(queryClearButton("Até")).toBeInTheDocument();
  });

  it("a data final: 'Limpar filtro Até' consulta sem to e mantém De e a ordenação", async () => {
    await renderLoaded();
    await sortByValueAscending();
    pickDate("De", "2026-06-01");
    pickDate("Até", "2026-06-30");
    await waitFor(() =>
      expect(lastParams()).toEqual({ ...SORT, from: "2026-06-01", to: "2026-06-30" }),
    );
    fireEvent.click(clearButton("Até"));
    await waitFor(() => expect(lastParams()).toEqual({ ...SORT, from: "2026-06-01" }));
    expect(screen.getByLabelText("Até")).toHaveTextContent("Selecione a data");
    expect(screen.getByLabelText("De")).toHaveTextContent("01/06/2026");
    expect(queryClearButton("Até")).not.toBeInTheDocument();
    expect(queryClearButton("De")).toBeInTheDocument();
  });

  it("o mês rápido: 'Limpar filtro Mês rápido' consulta sem from e to, habilita De e Até vazios e mantém o tipo e a ordenação", async () => {
    await renderLoaded();
    await sortByValueAscending();
    await chooseOption("Tipo", "Despesa");
    await chooseOption("Mês", "Junho");
    await chooseOption("Ano", "2026");
    await waitFor(() =>
      expect(lastParams()).toEqual({
        ...SORT,
        type: "Expense",
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    );
    fireEvent.click(clearButton("Mês rápido"));
    await waitFor(() => expect(lastParams()).toEqual({ ...SORT, type: "Expense" }));
    expect(screen.getByLabelText("De")).toBeEnabled();
    expect(screen.getByLabelText("Até")).toBeEnabled();
    expect(screen.getByLabelText("De")).toHaveTextContent("Selecione a data");
    expect(screen.getByLabelText("Até")).toHaveTextContent("Selecione a data");
    expect(screen.getByLabelText("Mês")).toHaveTextContent("Selecione o mês");
    expect(queryClearButton("Mês rápido")).not.toBeInTheDocument();
    expect(queryClearButton("Tipo")).toBeInTheDocument();
  });
});

describe("extrato: quando o 'x' de cada filtro aparece", () => {
  it("sem filtro ativo nenhum botão 'Limpar filtro ...' aparece, e 'Limpar filtros' continua", async () => {
    await renderLoaded();
    expect(clearButtons()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpar mês" })).toBeInTheDocument();
  });

  it("só o filtro com valor mostra o seu 'x' ao lado do rótulo", async () => {
    await renderLoaded();
    await chooseOption("Tipo", "Receita");
    await waitFor(() => expect(lastParams()["type"]).toBe("Income"));
    expect(clearButtons().map((button) => button.getAttribute("aria-label"))).toEqual([
      "Limpar filtro Tipo",
    ]);
    expect(clearButton("Tipo").previousElementSibling).toBe(
      screen.getByText("Tipo", { selector: "label" }),
    );
  });

  it("o 'x' da busca aparece com texto no campo e some com o campo vazio", async () => {
    await renderLoaded();
    expect(queryClearButton("Busca")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar por nome"), { target: { value: "a" } });
    expect(clearButton("Busca")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar por nome"), { target: { value: "" } });
    expect(queryClearButton("Busca")).not.toBeInTheDocument();
  });

  it("só o mês ou só o ano escolhido não mostra 'Limpar filtro Mês rápido'", async () => {
    await renderLoaded();
    await chooseOption("Mês", "Março");
    expect(queryClearButton("Mês rápido")).not.toBeInTheDocument();
    // the "Limpar mês" button still clears a half-chosen month
    fireEvent.click(screen.getByRole("button", { name: "Limpar mês" }));
    await chooseOption("Ano", "2026");
    expect(queryClearButton("Mês rápido")).not.toBeInTheDocument();
  });

  it("com o mês rápido ativo só ele tem 'x': De e Até (desabilitados) não mostram o seu", async () => {
    await renderLoaded();
    await chooseOption("Mês", "Junho");
    await chooseOption("Ano", "2026");
    await waitFor(() => expect(lastParams()["from"]).toBe("2026-06-01"));
    expect(screen.getByLabelText("De")).toBeDisabled();
    expect(queryClearButton("De")).not.toBeInTheDocument();
    expect(queryClearButton("Até")).not.toBeInTheDocument();
    expect(clearButton("Mês rápido")).toBeInTheDocument();
  });

  it("limpar o último filtro ativo consulta com os filtros base e remove todos os 'x'", async () => {
    await renderLoaded();
    pickDate("De", "2026-06-01");
    await waitFor(() => expect(lastParams()["from"]).toBe("2026-06-01"));
    fireEvent.click(clearButton("De"));
    await waitFor(() => expect(lastList()).toBe("/transactions?sort=date&order=desc&page=1"));
    expect(clearButtons()).toHaveLength(0);
  });

  it("com o período invertido, limpar De remove o alerta e consulta só com Até", async () => {
    await renderLoaded();
    pickDate("De", "2026-06-30");
    pickDate("Até", "2026-06-01");
    expect(await screen.findByText("A data inicial deve ser anterior à final")).toBeInTheDocument();
    fireEvent.click(clearButton("De"));
    await waitFor(() =>
      expect(
        screen.queryByText("A data inicial deve ser anterior à final"),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(lastParams()).toMatchObject({ to: "2026-06-01", page: "1" }));
    expect(lastParams()["from"]).toBeUndefined();
  });

  it("estando na página 2, limpar um filtro consulta a página 1", async () => {
    await renderLoaded();
    pickDate("De", "2026-06-01");
    await screen.findByText(/Página 1 de 3/);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByText(/Página 2 de 3/);
    expect(lastParams()["page"]).toBe("2");
    fireEvent.click(clearButton("De"));
    await waitFor(() => expect(lastParams()).toMatchObject({ page: "1" }));
    expect(lastParams()["from"]).toBeUndefined();
    await screen.findByText(/Página 1 de 3/);
  });
});

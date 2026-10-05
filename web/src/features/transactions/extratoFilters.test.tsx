import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatBRL } from "@/lib/format";
import { mockRequest } from "@/lib/api/mock";
import type { Account, Category, TransactionsPage as Page } from "@/lib/api/types";
import { renderWithQuery, requests, resetSpy } from "@/test/apiSpy";
import { pickDate } from "@/test/datePicker";
import { TransactionsPage } from "./TransactionsPage";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

const DEFAULT_QUERY = "/transactions?sort=date&order=desc&page=1";

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
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const renderLoaded = async () => {
  renderWithQuery(<TransactionsPage />);
  await screen.findByText(/Página 1 de 3/);
  // let the initial search debounce (300 ms) settle before interacting
  await sleep(350);
};
const clickButton = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));
const chooseOption = async (label: string, option: string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole("option", { name: option }));
};
const goToPageTwo = async () => {
  clickButton("Próxima");
  await screen.findByText(/Página 2 de 3/);
  expect(lastList()).toContain("page=2");
};
const resetToDefault = async () => {
  clickButton("Limpar filtros");
  await screen.findByText(/Página 1 de 3/);
  await waitFor(() => expect(lastList()).toBe(DEFAULT_QUERY));
};

describe("extrato: busca, filtros, ordenação e paginação", () => {
  it("consulta uma única vez 300 ms depois de parar de digitar, com q e página 1", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithQuery(<TransactionsPage />);
    await screen.findByText(/Página 1 de 3/);
    await act(() => vi.advanceTimersByTimeAsync(350));
    const before = listPaths().length;
    const search = screen.getByLabelText("Buscar por nome");
    fireEvent.change(search, { target: { value: "Super" } });
    await act(() => vi.advanceTimersByTimeAsync(200));
    fireEvent.change(search, { target: { value: "Supermercado" } });
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(listPaths()).toHaveLength(before);
    await act(() => vi.advanceTimersByTimeAsync(150));
    await waitFor(() => expect(listPaths()).toHaveLength(before + 1));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(listPaths().slice(before)).toEqual([
      "/transactions?sort=date&order=desc&page=1&q=Supermercado",
    ]);
  });

  it("cada filtro envia o seu parâmetro e volta para a página 1 depois de navegar para a 2", async () => {
    const [account] = await mockRequest<Account[]>({ method: "GET", path: "/accounts" });
    const [category] = (
      await mockRequest<Category[]>({ method: "GET", path: "/categories" })
    ).slice(-1);
    if (!account || !category) throw new Error("seed");
    const cases: Array<[string, () => Promise<void> | boolean | void, string]> = [
      ["tipo", () => chooseOption("Tipo", "Receita"), "type=Income"],
      ["neutra", () => chooseOption("Neutra", "Sim"), "neutral=true"],
      ["conta", () => chooseOption("Conta", account.nickname), `accountId=${account.id}`],
      ["categoria", () => chooseOption("Categoria", category.name), `categoryId=${category.id}`],
      ["data inicial", () => pickDate("De", "2026-04-01"), "from=2026-04-01"],
      ["data final", () => pickDate("Até", "2026-12-31"), "to=2026-12-31"],
    ];
    await renderLoaded();
    for (const [, apply, param] of cases) {
      await goToPageTwo();
      await apply();
      await waitFor(() => expect(lastList()).toContain(param));
      expect(lastList()).toContain("page=1");
      expect(lastList()).not.toContain("page=2");
      await resetToDefault();
    }
  }, 30_000);

  it("'Limpar filtros' restaura a consulta padrão: sem filtros, data decrescente, página 1", async () => {
    await renderLoaded();
    await chooseOption("Tipo", "Despesa");
    pickDate("De", "2026-01-01");
    fireEvent.change(screen.getByLabelText("Buscar por nome"), { target: { value: "Farmácia" } });
    await waitFor(() => expect(lastList()).toContain("q=Farm"));
    expect(lastList()).toContain("type=Expense");
    expect(lastList()).toContain("from=2026-01-01");
    clickButton("Limpar filtros");
    await waitFor(() => expect(lastList()).toBe(DEFAULT_QUERY));
    expect(screen.getByLabelText("Buscar por nome")).toHaveValue("");
    expect(screen.getByLabelText("De")).toHaveTextContent("Selecione a data");
    expect(screen.getByLabelText("Tipo")).toHaveTextContent("Todos");
    await sleep(400);
    expect(lastList()).toBe(DEFAULT_QUERY);
  });

  it("'Limpar filtros' volta à página 1 mesmo quando o usuário está na página 2 sem nenhuma busca pendente", async () => {
    await renderLoaded();
    await goToPageTwo();
    clickButton("Limpar filtros");
    expect(await screen.findByText(/Página 1 de 3/)).toBeInTheDocument();
    await waitFor(() => expect(lastList()).toBe(DEFAULT_QUERY));
    expect(lastList()).not.toContain("page=2");
  });

  it("abre com a primeira consulta sem from nem to e com De e Até mostrando 'Selecione a data'", async () => {
    await renderLoaded();
    expect(listPaths()[0]).toBe(DEFAULT_QUERY);
    expect(listPaths().some((path) => /[?&](from|to)=/.test(path))).toBe(false);
    expect(screen.getByLabelText("De")).toHaveTextContent("Selecione a data");
    expect(screen.getByLabelText("Até")).toHaveTextContent("Selecione a data");
  });

  it("'Limpar filtros' esvazia De e Até e consulta sem from nem to, saindo de datas escolhidas", async () => {
    await renderLoaded();
    pickDate("De", "2026-04-01");
    pickDate("Até", "2026-12-31");
    await waitFor(() => expect(lastList()).toContain("to=2026-12-31"));
    expect(screen.getByLabelText("De")).toHaveTextContent("01/04/2026");
    expect(screen.getByLabelText("Até")).toHaveTextContent("31/12/2026");
    clickButton("Limpar filtros");
    await waitFor(() => expect(lastList()).toBe(DEFAULT_QUERY));
    expect(screen.getByLabelText("De")).toHaveTextContent("Selecione a data");
    expect(screen.getByLabelText("Até")).toHaveTextContent("Selecione a data");
  });

  it("não tem a coluna Tipo na tabela: nem cabeçalho nem célula com Receita ou Despesa", async () => {
    await renderLoaded();
    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent ?? "");
    expect(headers.some((text) => /Tipo/.test(text))).toBe(false);
    expect(headers.some((text) => /Valor/.test(text))).toBe(true);
    const cells = within(screen.getByRole("table")).getAllByRole("cell");
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.some((cell) => /^(Receita|Despesa)$/.test(cell.textContent ?? ""))).toBe(false);
  });

  it("o cartão móvel não tem o campo Tipo, e o filtro Tipo continua na tela", async () => {
    await renderLoaded();
    const cards = screen.getAllByRole("article");
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(within(card).queryByText("Tipo")).not.toBeInTheDocument();
      expect(within(card).getByText("Método")).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Tipo")).toHaveTextContent("Todos");
  });

  it("clicar em 'Valor' duas vezes pede ordem crescente e depois decrescente, nessa sequência", async () => {
    await renderLoaded();
    const before = listPaths().length;
    clickButton(/Valor/);
    await waitFor(() => expect(lastList()).toBe("/transactions?sort=amount&order=asc&page=1"));
    const asc = await mockRequest<Page>({
      method: "GET",
      path: "/transactions?sort=amount&order=asc&page=1",
    });
    const firstRow = () => screen.getAllByRole("row")[1] as HTMLElement;
    await waitFor(() =>
      expect(firstRow()).toHaveTextContent(formatBRL(asc.items[0]!.amount).replace(/\s/g, " ")),
    );
    clickButton(/Valor/);
    await waitFor(() => expect(lastList()).toBe("/transactions?sort=amount&order=desc&page=1"));
    const desc = await mockRequest<Page>({
      method: "GET",
      path: "/transactions?sort=amount&order=desc&page=1",
    });
    await waitFor(() =>
      expect(within(firstRow()).getAllByText(/R\$/)[0]?.textContent).toContain(
        formatBRL(desc.items[0]!.amount),
      ),
    );
    expect(
      listPaths()
        .slice(before)
        .filter((path) => path.includes("sort=amount")),
    ).toEqual([
      "/transactions?sort=amount&order=asc&page=1",
      "/transactions?sort=amount&order=desc&page=1",
    ]);
  });

  it("mostra 'Nenhuma transação encontrada' e sem rodapé quando a busca não encontra nada", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByLabelText("Buscar por nome"), {
      target: { value: "zzz sem resultado" },
    });
    expect(await screen.findByText("Nenhuma transação encontrada")).toBeInTheDocument();
    expect(lastList()).toContain("q=zzz+sem+resultado");
    expect(screen.queryByText(/Página \d+ de/)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("com mais de 50 transações mostra 'Página 1 de 3' e Próxima/Anterior navegam e desabilitam nas pontas", async () => {
    renderWithQuery(<TransactionsPage />);
    expect(await screen.findByText(/120 transações · Página 1 de 3/)).toBeInTheDocument();
    const prev = () => screen.getByRole("button", { name: "Anterior" });
    const next = () => screen.getByRole("button", { name: "Próxima" });
    expect(prev()).toBeDisabled();
    expect(next()).toBeEnabled();
    fireEvent.click(next());
    await screen.findByText(/Página 2 de 3/);
    expect(lastList()).toBe("/transactions?sort=date&order=desc&page=2");
    expect(prev()).toBeEnabled();
    fireEvent.click(next());
    await screen.findByText(/Página 3 de 3/);
    expect(lastList()).toContain("page=3");
    expect(next()).toBeDisabled();
    fireEvent.click(prev());
    await screen.findByText(/Página 2 de 3/);
    fireEvent.click(prev());
    await screen.findByText(/Página 1 de 3/);
    expect(lastList()).toBe(DEFAULT_QUERY);
    expect(prev()).toBeDisabled();
  });
});

import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatBRL } from "@/lib/format";
import { mockRequest } from "@/lib/api/mock";
import type { Account, Category, TransactionsPage as Page } from "@/lib/api/types";
import { renderWithQuery, requests, resetSpy } from "@/test/apiSpy";
import { pickDate } from "@/test/datePicker";
import { lightList, trimTransactions } from "@/test/extratoKit";
import { TransactionsPage } from "./TransactionsPage";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

const DEFAULT_QUERY = "/transactions?sort=date&order=desc&page=1";

// The pickers hold no value, so their calendar opens on the month of the clock (June 2026): the tests
// pick days of that month. The clock never moves back, because react-query would then see its cached
// pages as not stale. Only the clock is faked; a test that waits for the 300 ms search debounce calls
// `withDebounceClock()` to fake the timers too and advances them explicitly.
const NOW = new Date(2026, 5, 15, 12);
beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: NOW }));
const withDebounceClock = () => {
  vi.useRealTimers();
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
};
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
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

/** The tests check the query the page sends: the list answers with 3 rows and a total of 120 (see `lightList`). */
const renderLoaded = async (options: { real?: boolean } = {}) => {
  if (options.real) {
    await trimTransactions(8);
  } else {
    await lightList();
    // a light list answers so fast that a click could land before the 300 ms search debounce of the still empty
    // search, which would then send the page back to 1: fake the timers and let it settle first (L-021)
    withDebounceClock();
  }
  renderWithQuery(<TransactionsPage />);
  await screen.findByText(options.real ? /Página 1 de 1/ : /Página 1 de 3/);
  if (!options.real) await advance(350);
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
    withDebounceClock();
    await renderLoaded();
    await advance(350);
    const before = listPaths().length;
    const search = screen.getByLabelText("Buscar por nome");
    fireEvent.change(search, { target: { value: "Super" } });
    await advance(200);
    fireEvent.change(search, { target: { value: "Supermercado" } });
    await advance(200);
    expect(listPaths()).toHaveLength(before);
    await advance(150);
    await waitFor(() => expect(listPaths()).toHaveLength(before + 1));
    await advance(1000);
    expect(listPaths().slice(before)).toEqual([
      "/transactions?sort=date&order=desc&page=1&q=Supermercado",
    ]);
  });

  // One test per filter: each Select round trip costs ~1 s in jsdom, so a single loop over all of them was slow.
  it.each(["tipo", "neutra", "conta", "categoria", "data inicial", "data final"])(
    "o filtro %s envia o seu parâmetro e volta para a página 1 depois de navegar para a 2",
    async (name) => {
      const [account] = await mockRequest<Account[]>({ method: "GET", path: "/accounts" });
      const [category] = (
        await mockRequest<Category[]>({ method: "GET", path: "/categories" })
      ).slice(-1);
      if (!account || !category) throw new Error("seed");
      const cases: Record<string, [() => Promise<void> | boolean | void, string]> = {
        tipo: [() => chooseOption("Tipo", "Receita"), "type=Income"],
        neutra: [() => chooseOption("Neutra", "Sim"), "neutral=true"],
        conta: [() => chooseOption("Conta", account.nickname), `accountId=${account.id}`],
        categoria: [() => chooseOption("Categoria", category.name), `categoryId=${category.id}`],
        "data inicial": [() => pickDate("De", "2026-06-01"), "from=2026-06-01"],
        "data final": [() => pickDate("Até", "2026-06-30"), "to=2026-06-30"],
      };
      const [apply, param] = cases[name] as (typeof cases)[string];
      await renderLoaded();
      await goToPageTwo();
      await apply();
      await waitFor(() => expect(lastList()).toContain(param));
      expect(lastList()).toContain("page=1");
      expect(lastList()).not.toContain("page=2");
      await resetToDefault();
    },
  );

  it("'Limpar filtros' restaura a consulta padrão: sem filtros, data decrescente, página 1", async () => {
    withDebounceClock();
    await renderLoaded();
    await chooseOption("Tipo", "Despesa");
    pickDate("De", "2026-06-01");
    fireEvent.change(screen.getByLabelText("Buscar por nome"), { target: { value: "Farmácia" } });
    await advance(300);
    await waitFor(() => expect(lastList()).toContain("q=Farm"));
    expect(lastList()).toContain("type=Expense");
    expect(lastList()).toContain("from=2026-06-01");
    clickButton("Limpar filtros");
    await waitFor(() => expect(lastList()).toBe(DEFAULT_QUERY));
    expect(screen.getByLabelText("Buscar por nome")).toHaveValue("");
    expect(screen.getByLabelText("De")).toHaveTextContent("Selecione a data");
    expect(screen.getByLabelText("Tipo")).toHaveTextContent("Todos");
    // the debounce fires for the emptied search and must not bring a filter back
    await advance(400);
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
    pickDate("De", "2026-06-01");
    pickDate("Até", "2026-06-30");
    await waitFor(() => expect(lastList()).toContain("to=2026-06-30"));
    expect(screen.getByLabelText("De")).toHaveTextContent("01/06/2026");
    expect(screen.getByLabelText("Até")).toHaveTextContent("30/06/2026");
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
    await renderLoaded({ real: true }); // the rows themselves are checked
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
    withDebounceClock();
    await renderLoaded();
    await lightList({ total: 0 }); // from now on the API finds nothing
    fireEvent.change(screen.getByLabelText("Buscar por nome"), {
      target: { value: "zzz sem resultado" },
    });
    await advance(300);
    expect(await screen.findByText("Nenhuma transação encontrada")).toBeInTheDocument();
    expect(lastList()).toContain("q=zzz+sem+resultado");
    expect(screen.queryByText(/Página \d+ de/)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("com mais de 50 transações mostra 'Página 1 de 3' e Próxima/Anterior navegam e desabilitam nas pontas", async () => {
    await renderLoaded();
    expect(screen.getByText(/120 transações · Página 1 de 3/)).toBeInTheDocument();
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

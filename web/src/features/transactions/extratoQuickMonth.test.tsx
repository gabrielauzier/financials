import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockRequest } from "@/lib/api/mock";
import type { Account, Transaction } from "@/lib/api/types";
import { renderWithQuery, requests, resetSpy, responses } from "@/test/apiSpy";
import { lightList } from "@/test/extratoKit";
import { TransactionsPage } from "./TransactionsPage";
import { applyDateFilter, monthRange } from "./utils";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

const DEFAULT_QUERY = "/transactions?sort=date&order=desc&page=1";

// "today" is mid-2027, so the year selector (current year - 5 to + 1) offers 2022 to 2028.
beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(2027, 5, 15, 12) }));
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
const chooseOption = async (label: string, option: string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole("option", { name: option }));
};
const clickButton = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
/** Most tests check the query the page sends, not the rows: the list answers with 3 rows (see `lightList`). */
const renderLoaded = async (options: { total?: number } = {}) => {
  await lightList(options);
  renderWithQuery(<TransactionsPage />);
  await screen.findByText(/Página 1 de/);
  // let the initial search debounce (300 ms) settle before interacting
  await act(() => vi.advanceTimersByTimeAsync(350));
};
const seed = async (name: string, day: Date) => {
  const [account] = await mockRequest<Account[]>({ method: "GET", path: "/accounts?active=true" });
  return mockRequest<Transaction>({
    method: "POST",
    path: "/transactions",
    body: {
      name,
      type: "Expense",
      occurredAt: day.toISOString(),
      amount: "10.00",
      accountId: account?.id,
      paymentMethod: "PIX",
    },
  });
};

describe("monthRange", () => {
  it("devolve o primeiro e o último dia: fevereiro bissexto e comum, meses de 30 e 31 dias e dezembro", () => {
    expect(monthRange(2028, 2)).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange(2027, 2)).toEqual({ from: "2027-02-01", to: "2027-02-28" });
    expect(monthRange(2000, 2).to).toBe("2000-02-29");
    expect(monthRange(2100, 2).to).toBe("2100-02-28");
    for (const month of [4, 6, 9, 11]) {
      expect(monthRange(2026, month).to).toBe(`2026-${String(month).padStart(2, "0")}-30`);
    }
    for (const month of [1, 3, 5, 7, 8, 10]) {
      expect(monthRange(2026, month).to).toBe(`2026-${String(month).padStart(2, "0")}-31`);
    }
    expect(monthRange(2026, 12)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(monthRange(2027, 1)).toEqual({ from: "2027-01-01", to: "2027-01-31" });
  });
});

describe("applyDateFilter", () => {
  const state = {
    filters: { sort: "date", order: "desc", page: 3, from: "2028-02-01", to: "2028-02-29" },
    quick: { year: 2028, month: 2 },
  } as const;

  it("define a data, desativa o filtro rápido, volta à página 1 e mantém o resto", () => {
    expect(applyDateFilter({ ...state }, "to", "2028-02-10")).toEqual({
      filters: { sort: "date", order: "desc", page: 1, from: "2028-02-01", to: "2028-02-10" },
      quick: {},
    });
    expect(applyDateFilter({ ...state }, "from", "2028-02-05")).toEqual({
      filters: { sort: "date", order: "desc", page: 1, from: "2028-02-05", to: "2028-02-29" },
      quick: {},
    });
  });

  it("valor vazio remove a data e não altera o estado recebido", () => {
    const next = applyDateFilter({ ...state }, "from", "");
    expect(next.filters).toEqual({
      sort: "date",
      order: "desc",
      page: 1,
      to: "2028-02-29",
    });
    expect(next.quick).toEqual({});
    expect(state.filters.from).toBe("2028-02-01");
    expect(state.quick).toEqual({ year: 2028, month: 2 });
  });
});

describe("extrato: filtro rápido de mês e ano", () => {
  it("fevereiro de 2028 consulta de 2028-02-01 a 2028-02-29 na página 1 e desabilita De e Até mostrando as datas", async () => {
    await renderLoaded();
    await chooseOption("Mês", "Fevereiro");
    await chooseOption("Ano", "2028");
    await waitFor(() => expect(lastList()).toBe(`${DEFAULT_QUERY}&from=2028-02-01&to=2028-02-29`));
    expect(screen.getByLabelText("De")).toBeDisabled();
    expect(screen.getByLabelText("Até")).toBeDisabled();
    expect(screen.getByLabelText("De")).toHaveTextContent("01/02/2028");
    expect(screen.getByLabelText("Até")).toHaveTextContent("29/02/2028");
  });

  it("em ano comum fevereiro termina no dia 28 e as transações das bordas do mês entram e saem", async () => {
    await seed("Borda antes", new Date(2027, 0, 31, 12));
    await seed("Borda primeiro", new Date(2027, 1, 1, 12));
    await seed("Borda último", new Date(2027, 1, 28, 12));
    await seed("Borda depois", new Date(2027, 2, 1, 12));
    // light while unfiltered, the real mock list once the month filter is on (the rows are what this test checks)
    await renderLoaded();
    const light = responses.get("GET /transactions") as () => unknown;
    responses.set("GET /transactions", () =>
      new URLSearchParams(lastList().split("?")[1]).get("from")
        ? mockRequest({ method: "GET", path: lastList() })
        : light(),
    );
    await chooseOption("Ano", "2027");
    await chooseOption("Mês", "Fevereiro");
    await waitFor(() => expect(lastList()).toContain("from=2027-02-01&to=2027-02-28"));
    expect((await screen.findAllByText("Borda primeiro")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Borda último").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Borda antes")).toHaveLength(0);
    expect(screen.queryAllByText("Borda depois")).toHaveLength(0);
  });

  it("só o mês ou só o ano não consulta a API nem altera De e Até", async () => {
    await renderLoaded();
    const before = listPaths().length;
    await chooseOption("Mês", "Março");
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(listPaths()).toHaveLength(before);
    expect(screen.getByLabelText("De")).toBeEnabled();
    expect(screen.getByLabelText("De")).toHaveTextContent("Selecione a data");
    clickButton("Limpar mês");
    await chooseOption("Ano", "2027");
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(listPaths()).toHaveLength(before);
    expect(screen.getByLabelText("Até")).toBeEnabled();
    expect(screen.getByLabelText("Até")).toHaveTextContent("Selecione a data");
  });

  it("'Limpar mês' remove o filtro rápido e from/to, volta à página 1 e habilita os pickers", async () => {
    await renderLoaded();
    await chooseOption("Mês", "Janeiro");
    await chooseOption("Ano", "2026");
    await waitFor(() => expect(lastList()).toContain("from=2026-01-01&to=2026-01-31"));
    clickButton("Limpar mês");
    await waitFor(() => expect(lastList()).toBe(DEFAULT_QUERY));
    expect(screen.getByLabelText("De")).toBeEnabled();
    expect(screen.getByLabelText("De")).toHaveTextContent("Selecione a data");
    expect(screen.getByLabelText("Mês")).toHaveTextContent("Selecione o mês");
    expect(screen.getByLabelText("Ano")).toHaveTextContent("Selecione o ano");
  });

  it("'Limpar filtros' limpa o filtro rápido junto com os demais filtros", async () => {
    await renderLoaded();
    await chooseOption("Tipo", "Despesa");
    await chooseOption("Mês", "Dezembro");
    await chooseOption("Ano", "2026");
    await waitFor(() => expect(lastList()).toContain("from=2026-12-01&to=2026-12-31"));
    expect(lastList()).toContain("type=Expense");
    clickButton("Limpar filtros");
    await waitFor(() => expect(lastList()).toBe(DEFAULT_QUERY));
    expect(screen.getByLabelText("Mês")).toHaveTextContent("Selecione o mês");
    expect(screen.getByLabelText("Ano")).toHaveTextContent("Selecione o ano");
    expect(screen.getByLabelText("De")).toBeEnabled();
    expect(screen.getByLabelText("Até")).toBeEnabled();
  });

  it("mudar a página mantém from e to do mês", async () => {
    await renderLoaded({ total: 60 });
    await chooseOption("Ano", "2028");
    await chooseOption("Mês", "Fevereiro");
    await screen.findByText(/Página 1 de 2/);
    clickButton("Próxima");
    await screen.findByText(/Página 2 de 2/);
    expect(lastList()).toBe(
      `${DEFAULT_QUERY.replace("page=1", "page=2")}&from=2028-02-01&to=2028-02-29`,
    );
    expect(screen.getByLabelText("De")).toBeDisabled();
    expect(screen.getByLabelText("De")).toHaveTextContent("01/02/2028");
  });

  it("escolher mês e ano estando na página 2 consulta a página 1 do mês", async () => {
    await renderLoaded();
    clickButton("Próxima");
    await screen.findByText(/Página 2 de \d+/);
    expect(lastList()).toBe(DEFAULT_QUERY.replace("page=1", "page=2"));
    await chooseOption("Mês", "Fevereiro");
    await chooseOption("Ano", "2028");
    await waitFor(() => expect(lastList()).toContain("from=2028-02-01&to=2028-02-29"));
    expect(lastList()).toContain("page=1");
    expect(lastList()).not.toContain("page=2");
  });

  it("'Limpar mês' estando na página 2 do mês consulta a página 1 sem datas", async () => {
    await renderLoaded({ total: 60 });
    await chooseOption("Ano", "2028");
    await chooseOption("Mês", "Fevereiro");
    await screen.findByText(/Página 1 de \d+/);
    clickButton("Próxima");
    await screen.findByText(/Página 2 de \d+/);
    expect(lastList()).toContain("page=2&from=2028-02-01&to=2028-02-29");
    clickButton("Limpar mês");
    await waitFor(() => expect(lastList()).toBe(DEFAULT_QUERY));
    expect(await screen.findByText(/Página 1 de \d+/)).toBeInTheDocument();
  });

  it("o seletor de ano oferece do ano atual menos 5 até o ano atual mais 1 (2022 a 2028 com o relógio em 2027)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByLabelText("Ano"));
    await screen.findByRole("option", { name: "2027" });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "2022",
      "2023",
      "2024",
      "2025",
      "2026",
      "2027",
      "2028",
    ]);
  });

  it("trocar o mês depois de ativo consulta o novo mês e volta à página 1", async () => {
    await renderLoaded();
    await chooseOption("Mês", "Fevereiro");
    await chooseOption("Ano", "2028");
    await waitFor(() => expect(lastList()).toContain("to=2028-02-29"));
    await chooseOption("Mês", "Abril");
    await waitFor(() => expect(lastList()).toContain("from=2028-04-01&to=2028-04-30"));
    expect(lastList()).toContain("page=1");
    expect(screen.getByLabelText("Até")).toHaveTextContent("30/04/2028");
  });
});

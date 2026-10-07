import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockRequest } from "@/lib/api/mock";
import type { Account, Category } from "@/lib/api/types";
import { failures, renderWithQuery, requests, resetSpy } from "@/test/apiSpy";
import { pickDate } from "@/test/datePicker";
import {
  advance,
  cannedSummary,
  chooseOption,
  fakeClock,
  flush,
  lastListParams,
  lastSummaryParams,
  lightList,
  listPaths,
  summaryPaths,
  waitForList,
} from "@/test/extratoKit";
import { TransactionsPage } from "./TransactionsPage";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

beforeEach(() => {
  fakeClock();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  resetSpy();
  localStorage.clear();
  vi.useRealTimers();
});

const region = () => screen.getByRole("region", { name: "Resumo do extrato" });
const toggle = (label: string) => within(region()).getByRole("button", { name: new RegExp(label) });
const clearButton = (label: string) =>
  screen.getByRole("button", { name: `Limpar filtro ${label}` });

/** Opens the extrato with a light list and a canned summary, and waits for both and for the search debounce. */
const renderLoaded = async () => {
  await lightList();
  cannedSummary();
  renderWithQuery(<TransactionsPage />);
  await screen.findByText(/Página 1 de 3/);
  await within(region()).findByText("R$ 1.234,56");
  await advance(350);
};
const SORT = { sort: "date", order: "desc" };

describe("extrato: o cartão de resumo", () => {
  it("consulta o resumo uma vez ao abrir, sem parâmetros, e mostra os valores da API entre os filtros e a lista", async () => {
    await renderLoaded();
    expect(summaryPaths()).toEqual(["/transactions/summary"]);
    expect(within(region()).getByText("120")).toBeInTheDocument();
    expect(toggle("Receitas")).toHaveTextContent("R$ 1.234,56");
    expect(toggle("Despesas")).toHaveTextContent("R$ 100,00");
    expect(toggle("Investimentos")).toHaveTextContent("R$ 50,00");
    expect(within(region()).getByText("Saldo").parentElement).toHaveTextContent("R$ 1.134,56");
    const filters = screen.getByRole("region", { name: "Filtros do extrato" });
    const list = screen.getByRole("table");
    expect(
      filters.compareDocumentPosition(region()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(region().compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("mostra os valores da API e não a soma das linhas da tela", async () => {
    await lightList();
    cannedSummary({ income: "9999.99", count: 3000 });
    renderWithQuery(<TransactionsPage />);
    expect(await within(region()).findByText("R$ 9.999,99")).toBeInTheDocument();
    expect(within(region()).getByText("3.000")).toBeInTheDocument();
    // the page shows 3 rows and a total of 120: neither number is the summary count
    expect(await screen.findByText(/120 transações · Página 1 de 3/)).toBeInTheDocument();
  });

  it("um erro do resumo não esconde a lista, e 'Tentar novamente' do cartão repete só o resumo", async () => {
    await lightList();
    failures.set("GET /transactions/summary", new Error("falhou"));
    renderWithQuery(<TransactionsPage />);
    expect(
      await within(region()).findByText("Não foi possível carregar o resumo."),
    ).toBeInTheDocument();
    await screen.findByText(/Página 1 de 3/);
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4);
    failures.clear();
    cannedSummary();
    const before = requests.length;
    fireEvent.click(within(region()).getByRole("button", { name: "Tentar novamente" }));
    expect(await within(region()).findByText("R$ 1.234,56")).toBeInTheDocument();
    expect(requests.slice(before).map((request) => request.path)).toEqual([
      "/transactions/summary",
    ]);
  });

  it("um erro da lista não esconde o cartão", async () => {
    cannedSummary();
    failures.set("GET /transactions", new Error("falhou"));
    renderWithQuery(<TransactionsPage />);
    expect(await screen.findByText("Não foi possível carregar o extrato.")).toBeInTheDocument();
    expect(await within(region()).findByText("R$ 1.234,56")).toBeInTheDocument();
  });

  it("com o período invertido não mostra o cartão nem consulta o resumo, e volta quando o período se corrige", async () => {
    await renderLoaded();
    pickDate("De", "2026-06-20");
    await waitFor(() => expect(summaryPaths()).toHaveLength(2));
    pickDate("Até", "2026-06-10");
    expect(await screen.findByText("A data inicial deve ser anterior à final")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Resumo do extrato" })).toBeNull();
    await flush();
    expect(summaryPaths()).toHaveLength(2);
    fireEvent.click(clearButton("Até"));
    expect(await within(region()).findByText("R$ 1.234,56")).toBeInTheDocument();
    expect(lastSummaryParams()).toEqual({ from: "2026-06-20" });
  });
});

describe("extrato: quando o resumo é consultado de novo", () => {
  const account = async () =>
    (await mockRequest<Account[]>({ method: "GET", path: "/accounts" }))[0] as Account;
  const category = async () =>
    (await mockRequest<Category[]>({ method: "GET", path: "/categories" })).slice(
      -1,
    )[0] as Category;

  it.each([
    ["Tipo", () => chooseOption("Tipo", "Receita"), () => ({ type: "Income" })],
    [
      "Conta",
      async () => chooseOption("Conta", (await account()).nickname),
      async () => ({ accountId: (await account()).id }),
    ],
    [
      "Categoria",
      async () => chooseOption("Categoria", (await category()).name),
      async () => ({ categoryId: (await category()).id }),
    ],
    ["Neutra", () => chooseOption("Neutra", "Sim"), () => ({ neutral: "true" })],
    ["De", () => pickDate("De", "2026-06-01"), () => ({ from: "2026-06-01" })],
    ["Até", () => pickDate("Até", "2026-06-30"), () => ({ to: "2026-06-30" })],
    [
      "Mês rápido",
      async () => {
        await chooseOption("Mês", "Junho");
        await chooseOption("Ano", "2026");
      },
      () => ({ from: "2026-06-01", to: "2026-06-30" }),
    ],
    [
      "Busca",
      async () => {
        fireEvent.change(screen.getByLabelText("Buscar por nome"), { target: { value: "Farm" } });
        await advance(300);
      },
      () => ({ q: "Farm" }),
    ],
  ])(
    "mudar %s consulta o resumo de novo, só com aquele filtro",
    async (_label, apply, expected) => {
      await renderLoaded();
      expect(summaryPaths()).toHaveLength(1);
      await apply();
      await waitFor(() => expect(summaryPaths()).toHaveLength(2));
      expect(lastSummaryParams()).toEqual(await expected());
      for (const name of ["sort", "order", "page", "pageSize"]) {
        expect(lastSummaryParams()[name], name).toBeUndefined();
      }
    },
  );

  it("ir para outra página, ordenar e trocar o tamanho da página não consultam o resumo de novo", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitForList((params) => expect(params["page"]).toBe("2"));
    fireEvent.click(screen.getByRole("button", { name: "Página 3" }));
    await waitForList((params) => expect(params["page"]).toBe("3"));
    fireEvent.click(screen.getByRole("button", { name: /Valor/ }));
    await waitForList((params) => expect(params).toMatchObject({ sort: "amount", page: "1" }));
    await chooseOption("Itens por página", "25");
    await waitForList((params) => expect(params["pageSize"]).toBe("25"));
    await flush();
    expect(summaryPaths()).toEqual(["/transactions/summary"]);
  });
});

describe("extrato: clicar nos valores do resumo", () => {
  const investmentsId = async () =>
    (await mockRequest<Category[]>({ method: "GET", path: "/categories" })).find(
      (item) => item.key === "Investments",
    )?.id as string;

  /** Sort by value, pick De and go to page 2, so the click must reset the page and keep the rest. */
  const preparePageTwo = async () => {
    await renderLoaded();
    await waitFor(() => expect(toggle("Investimentos")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Valor/ }));
    await waitForList((params) => expect(params["sort"]).toBe("amount"));
    pickDate("De", "2026-06-01");
    await waitForList((params) => expect(params["from"]).toBe("2026-06-01"));
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitForList((params) => expect(params["page"]).toBe("2"));
  };
  const KEEP = { sort: "amount", order: "asc", from: "2026-06-01" };
  const goToPageTwo = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitForList((params) => expect(params["page"]).toBe("2"));
  };

  it.each([
    ["Receitas", "Income", "Receita"],
    ["Despesas", "Expense", "Despesa"],
  ])(
    "%s aplica type=%s da página 2 voltando à 1, e clicar de novo remove o filtro",
    async (label, type, shown) => {
      await preparePageTwo();
      fireEvent.click(toggle(label));
      await waitForList((params) => expect(params).toEqual({ ...KEEP, page: "1", type }));
      expect(screen.getByLabelText("Tipo")).toHaveTextContent(shown);
      expect(clearButton("Tipo")).toBeInTheDocument();
      expect(toggle(label)).toHaveAttribute("aria-pressed", "true");
      await within(region()).findByText("R$ 1.234,56");
      expect(lastSummaryParams()).toEqual({ from: "2026-06-01", type });

      await goToPageTwo();
      fireEvent.click(toggle(label));
      await waitForList((params) => expect(params).toEqual({ ...KEEP, page: "1" }));
      expect(screen.getByLabelText("Tipo")).toHaveTextContent("Todos");
      expect(toggle(label)).toHaveAttribute("aria-pressed", "false");
    },
  );

  it("Receitas troca Despesa por Receita e volta à página 1", async () => {
    await preparePageTwo();
    fireEvent.click(toggle("Despesas"));
    await waitForList((params) => expect(params["type"]).toBe("Expense"));
    await goToPageTwo();
    fireEvent.click(toggle("Receitas"));
    await waitForList((params) => expect(params).toEqual({ ...KEEP, page: "1", type: "Income" }));
  });

  it("Investimentos aplica a categoria da chave Investments da página 2 voltando à 1, e clicar de novo remove", async () => {
    const id = await investmentsId();
    await preparePageTwo();
    fireEvent.click(toggle("Investimentos"));
    await waitForList((params) => expect(params).toEqual({ ...KEEP, page: "1", categoryId: id }));
    expect(clearButton("Categoria")).toBeInTheDocument();
    expect(toggle("Investimentos")).toHaveAttribute("aria-pressed", "true");
    await within(region()).findByText("R$ 1.234,56");
    expect(lastSummaryParams()).toEqual({ from: "2026-06-01", categoryId: id });

    await goToPageTwo();
    fireEvent.click(toggle("Investimentos"));
    await waitForList((params) => expect(params).toEqual({ ...KEEP, page: "1" }));
    expect(toggle("Investimentos")).toHaveAttribute("aria-pressed", "false");
  });

  it("o valor fica marcado quando o filtro foi aplicado pelo controle de Tipo", async () => {
    await renderLoaded();
    await chooseOption("Tipo", "Despesa");
    await within(region()).findByText("R$ 1.234,56");
    expect(toggle("Despesas")).toHaveAttribute("aria-pressed", "true");
    expect(toggle("Receitas")).toHaveAttribute("aria-pressed", "false");
  });

  it("o Saldo não é botão e clicar nele não muda a consulta", async () => {
    await renderLoaded();
    const before = listPaths().length;
    fireEvent.click(within(region()).getByText("Saldo"));
    await flush();
    expect(listPaths()).toHaveLength(before);
    expect(lastListParams()).toEqual({ ...SORT, page: "1" });
    expect(within(region()).queryByRole("button", { name: /Saldo/ })).toBeNull();
  });
});

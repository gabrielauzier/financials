import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery, resetSpy, responses } from "@/test/apiSpy";
import {
  advance,
  cannedSummary,
  chooseOption,
  fakeClock,
  lastListParams,
  lightList,
  listPaths,
  waitForList,
} from "@/test/extratoKit";
import { TransactionsPage } from "./TransactionsPage";
import { PAGE_SIZE_STORAGE_KEY } from "./usePageSize";

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

const nav = () => screen.getByRole("navigation", { name: "Paginação do extrato" });
const pageButton = (n: number) => within(nav()).getByRole("button", { name: `Página ${n}` });
const sizeSelect = () => screen.getByLabelText("Itens por página");
const SORT = { sort: "date", order: "desc" };

const renderLoaded = async (after?: () => Promise<void> | void) => {
  await lightList();
  cannedSummary();
  renderWithQuery(<TransactionsPage />);
  await after?.();
  await screen.findByText(/120 transações · Página 1 de/);
  await advance(350);
};
const goToPageTwo = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  await waitForList((params) => expect(params["page"]).toBe("2"));
};

describe("extrato: a paginação", () => {
  it("abre sem tamanho guardado consultando sem pageSize, com 50 no seletor e os botões 1 2 3", async () => {
    await renderLoaded();
    expect(lastListParams()).toEqual({ ...SORT, page: "1" });
    expect(sizeSelect()).toHaveTextContent("50");
    expect(within(nav()).getByText("120 transações · Página 1 de 3")).toBeInTheDocument();
    expect(
      within(nav())
        .getAllByRole("button", { name: /^Página \d$/ })
        .map((button) => button.textContent),
    ).toEqual(["1", "2", "3"]);
    expect(screen.queryByRole("footer")).toBeNull();
  });

  it("Próxima, Anterior e um botão numerado consultam a página certa e mantêm filtros e ordenação", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: /Valor/ }));
    await waitForList((params) => expect(params["sort"]).toBe("amount"));
    fireEvent.click(pageButton(3));
    await waitForList((params) =>
      expect(params).toEqual({ sort: "amount", order: "asc", page: "3" }),
    );
    expect(await screen.findByText(/Página 3 de 3/)).toBeInTheDocument();
    expect(pageButton(3)).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await waitForList((params) => expect(params["page"]).toBe("2"));
    expect(pageButton(2)).toHaveAttribute("aria-current", "page");
  });

  it("conta as páginas pelo pageSize da resposta da API", async () => {
    responses.set("GET /transactions", () => ({ items: [], total: 120, page: 1, pageSize: 25 }));
    cannedSummary();
    renderWithQuery(<TransactionsPage />);
    expect(await screen.findByText("120 transações · Página 1 de 5")).toBeInTheDocument();
  });

  it("sem transações não mostra a paginação e o cartão mostra o estado vazio", async () => {
    await lightList({ total: 0 });
    cannedSummary({
      count: 0,
      income: "0.00",
      expense: "0.00",
      investments: "0.00",
      balance: "0.00",
    });
    renderWithQuery(<TransactionsPage />);
    expect(await screen.findByText("Nenhuma transação encontrada")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Paginação do extrato" })).toBeNull();
    const region = screen.getByRole("region", { name: "Resumo do extrato" });
    expect(await within(region).findByText("0")).toBeInTheDocument();
    expect(within(region).getAllByText("R$ 0,00")).toHaveLength(4);
  });
});

describe("extrato: itens por página", () => {
  it("o seletor lista 25, 50 e 100", async () => {
    await renderLoaded();
    fireEvent.click(sizeSelect());
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "25",
      "50",
      "100",
    ]);
  });

  it("escolher 25 estando na página 2 consulta pageSize=25 na página 1, guarda o valor e esvazia a seleção", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: /Valor/ }));
    await waitForList((params) => expect(params["sort"]).toBe("amount"));
    await goToPageTwo();
    fireEvent.click(screen.getByLabelText("Selecionar todas da página"));
    expect(await screen.findByText("3 selecionada(s)")).toBeInTheDocument();

    await chooseOption("Itens por página", "25");
    await waitForList((params) =>
      expect(params).toEqual({ sort: "amount", order: "asc", page: "1", pageSize: "25" }),
    );
    expect(localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe("25");
    expect(await screen.findByText("120 transações · Página 1 de 5")).toBeInTheDocument();
    expect(sizeSelect()).toHaveTextContent("25");
    expect(screen.queryByText(/selecionada\(s\)/)).toBeNull();
  });

  it("trocar o tamanho na página 1 (nenhum filtro muda) também esvazia a seleção de linhas", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByLabelText("Selecionar todas da página"));
    expect(await screen.findByText("3 selecionada(s)")).toBeInTheDocument();
    await chooseOption("Itens por página", "100");
    await waitForList((params) => expect(params["pageSize"]).toBe("100"));
    expect(screen.queryByText(/selecionada\(s\)/)).toBeNull();
  });

  it("escolher 100 consulta pageSize=100 e voltar para 50 consulta sem pageSize", async () => {
    await renderLoaded();
    await chooseOption("Itens por página", "100");
    await waitForList((params) => expect(params).toEqual({ ...SORT, page: "1", pageSize: "100" }));
    expect(await screen.findByText("120 transações · Página 1 de 2")).toBeInTheDocument();
    await chooseOption("Itens por página", "50");
    await waitForList((params) => expect(params).toEqual({ ...SORT, page: "1" }));
    expect(localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe("50");
  });

  it("trocar o tamanho não refaz a consulta do resumo e mantém os filtros", async () => {
    await renderLoaded();
    await chooseOption("Tipo", "Receita");
    await waitForList((params) => expect(params["type"]).toBe("Income"));
    await goToPageTwo();
    await chooseOption("Itens por página", "25");
    await waitForList((params) =>
      expect(params).toEqual({ ...SORT, type: "Income", page: "1", pageSize: "25" }),
    );
  });

  it("um tamanho 100 guardado faz a primeira consulta já levar pageSize=100", async () => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, "100");
    await renderLoaded();
    expect(listPaths()[0]).toBe("/transactions?sort=date&order=desc&page=1&pageSize=100");
    expect(sizeSelect()).toHaveTextContent("100");
    expect(await screen.findByText("120 transações · Página 1 de 2")).toBeInTheDocument();
  });

  it.each(["30", "abc", ""])(
    "um valor guardado inválido (%j) abre com 50 e sem pageSize",
    async (stored) => {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, stored);
      await renderLoaded();
      expect(lastListParams()["pageSize"]).toBeUndefined();
      expect(sizeSelect()).toHaveTextContent("50");
    },
  );

  it("quando o localStorage lança erro ao ler e ao gravar, abre com 50 e o tamanho ainda troca", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    await renderLoaded();
    expect(sizeSelect()).toHaveTextContent("50");
    await chooseOption("Itens por página", "25");
    await waitForList((params) => expect(params["pageSize"]).toBe("25"));
    expect(sizeSelect()).toHaveTextContent("25");
    vi.restoreAllMocks();
  });

  it("'Limpar filtros' mantém o tamanho escolhido: ele não é um filtro", async () => {
    await renderLoaded();
    await chooseOption("Itens por página", "25");
    await waitForList((params) => expect(params["pageSize"]).toBe("25"));
    await chooseOption("Tipo", "Receita");
    await waitForList((params) => expect(params["type"]).toBe("Income"));
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitForList((params) => expect(params).toEqual({ ...SORT, page: "1", pageSize: "25" }));
    expect(sizeSelect()).toHaveTextContent("25");
    expect(localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe("25");
  });
});

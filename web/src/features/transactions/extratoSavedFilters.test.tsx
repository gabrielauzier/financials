import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockRequest } from "@/lib/api/mock";
import type { Account, Category } from "@/lib/api/types";
import { renderWithQuery, requests, resetSpy } from "@/test/apiSpy";
import { pickDate } from "@/test/datePicker";
import {
  advance,
  chooseOption,
  fakeClock,
  lastListParams,
  lightList,
  listPaths,
} from "@/test/extratoKit";
import { TransactionsPage } from "./TransactionsPage";

const user = vi.hoisted(() => ({ id: "u1" as string | null }));
vi.mock("@/features/auth/useSessionUserId", () => ({ useSessionUserId: () => user.id }));
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("sonner")>()),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

// the key is spelled out here on purpose: a renamed key would silently drop every saved filter
const KEY = "financials:transactions:saved-filters:u1";
const seed = (filters: Array<{ name: string; state: object }>) =>
  localStorage.setItem(
    KEY,
    JSON.stringify({
      version: 1,
      filters: filters.map(({ name, state }) => ({ id: `id-${name}`, name, state })),
    }),
  );

let account: Account;
let category: Category;
beforeEach(async () => {
  user.id = "u1";
  localStorage.clear();
  fakeClock();
  account = (await mockRequest<Account[]>({ method: "GET", path: "/accounts" }))[0] as Account;
  category = (await mockRequest<Category[]>({ method: "GET", path: "/categories" }))[0] as Category;
});
afterEach(() => {
  cleanup();
  resetSpy();
  vi.useRealTimers();
  localStorage.clear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.info).mockClear();
});

const renderLoaded = async () => {
  await lightList();
  renderWithQuery(<TransactionsPage />);
  await screen.findByText(/Página 1 de/);
  // let the debounce of the (still empty) search settle before interacting
  await advance(350);
};
const goToPage2 = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Próxima" }));
  await waitFor(() => expect(lastListParams()["page"]).toBe("2"));
};
const openMenu = () => {
  const button = screen.getByRole("button", { name: "Filtros salvos" });
  button.focus();
  fireEvent.keyDown(button, { key: "Enter" });
};
const chooseFilter = (name: string | RegExp) => {
  openMenu();
  fireEvent.keyDown(screen.getByRole("menuitem", { name }), { key: "Enter" });
};
const appliedNames = () => {
  const names = screen
    .getAllByRole("menuitem")
    .filter((item) => item.getAttribute("aria-current") === "true")
    .map((item) => item.textContent?.replace("(aplicado)", ""));
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  return names;
};
const search = () => screen.getByLabelText("Buscar por nome");

describe("extrato: filtros salvos", () => {
  it("com usuário os botões Salvar filtro e Filtros salvos vêm depois do mês rápido; sem usuário não há nenhum", async () => {
    await renderLoaded();
    const clearMonth = screen.getByRole("button", { name: "Limpar mês" });
    for (const name of ["Salvar filtro", "Filtros salvos"]) {
      const button = screen.getByRole("button", { name });
      expect(clearMonth.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(button.closest("section")).toHaveAccessibleName("Filtros do extrato");
    }
    cleanup();
    user.id = null;
    await renderLoaded();
    expect(screen.queryByRole("button", { name: "Salvar filtro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filtros salvos" })).not.toBeInTheDocument();
  });

  it("aplicar a partir da página 2 troca todos os filtros por uma consulta exata na página 1 e preenche os controles", async () => {
    seed([
      {
        name: "Completo",
        state: {
          q: "farm",
          type: "Expense",
          accountId: account.id,
          categoryId: category.id,
          neutral: false,
          from: "2026-05-02",
          to: "2026-05-20",
          sort: "amount",
          order: "asc",
        },
      },
    ]);
    await renderLoaded();
    await chooseOption("Tipo", "Receita");
    await goToPage2();
    expect(lastListParams()).toEqual({ sort: "date", order: "desc", type: "Income", page: "2" });
    const before = listPaths().length;
    chooseFilter("Completo");
    await waitFor(() => expect(listPaths()).toHaveLength(before + 1));
    expect(lastListParams()).toEqual({
      q: "farm",
      type: "Expense",
      accountId: account.id,
      categoryId: category.id,
      neutral: "false",
      from: "2026-05-02",
      to: "2026-05-20",
      sort: "amount",
      order: "asc",
      page: "1",
    });
    expect(search()).toHaveValue("farm");
    expect(screen.getByLabelText("Tipo")).toHaveTextContent("Despesa");
    expect(screen.getByLabelText("Conta")).toHaveTextContent(account.nickname);
    expect(screen.getByLabelText("Categoria")).toHaveTextContent(category.name);
    expect(screen.getByLabelText("Neutra")).toHaveTextContent("Não");
    expect(screen.getByLabelText("De")).toHaveTextContent("02/05/2026");
    expect(screen.getByLabelText("Até")).toHaveTextContent("20/05/2026");
    const sorted = screen.getByRole("button", { name: /Valor/ });
    expect(sorted.querySelector(".lucide-arrow-up")).not.toBeNull();
    // the search text of the saved filter does not query again 300 ms later
    await advance(300);
    expect(listPaths()).toHaveLength(before + 1);
  });

  it("um filtro com mês rápido mostra mês e ano com De e Até travados, e um sem mês rápido o limpa", async () => {
    seed([
      { name: "Junho", state: { quick: { year: 2026, month: 6 }, sort: "name", order: "asc" } },
      { name: "Receitas", state: { type: "Income" } },
    ]);
    await renderLoaded();
    chooseFilter("Junho");
    await waitFor(() =>
      expect(lastListParams()).toEqual({
        from: "2026-06-01",
        to: "2026-06-30",
        sort: "name",
        order: "asc",
        page: "1",
      }),
    );
    expect(screen.getByLabelText("Mês")).toHaveTextContent("Junho");
    expect(screen.getByLabelText("Ano")).toHaveTextContent("2026");
    expect(screen.getByLabelText("De")).toBeDisabled();
    expect(screen.getByLabelText("De")).toHaveTextContent("01/06/2026");
    expect(screen.getByLabelText("Até")).toBeDisabled();
    openMenu();
    expect(appliedNames()).toEqual(["Junho"]);
    chooseFilter("Receitas");
    await waitFor(() =>
      expect(lastListParams()).toEqual({ type: "Income", sort: "date", order: "desc", page: "1" }),
    );
    expect(screen.getByLabelText("Mês")).toHaveTextContent("Selecione o mês");
    expect(screen.getByLabelText("Ano")).toHaveTextContent("Selecione o ano");
    expect(screen.getByLabelText("De")).toBeEnabled();
    expect(screen.getByLabelText("De")).toHaveTextContent("Selecione a data");
  });

  it("a busca do filtro aparece na hora, uma digitação ainda em espera é descartada e um filtro sem busca esvazia o campo", async () => {
    seed([
      { name: "Mercado", state: { q: "mercado" } },
      { name: "Sem busca", state: { type: "Income" } },
    ]);
    await renderLoaded();
    fireEvent.change(search(), { target: { value: "ainda digitando" } });
    const before = listPaths().length;
    chooseFilter("Mercado");
    expect(search()).toHaveValue("mercado");
    await waitFor(() => expect(lastListParams()["q"]).toBe("mercado"));
    await advance(300);
    expect(listPaths()).toHaveLength(before + 1);
    expect(lastListParams()["q"]).toBe("mercado");
    chooseFilter("Sem busca");
    expect(search()).toHaveValue("");
    await waitFor(() => expect(lastListParams()["q"]).toBeUndefined());
    await advance(300);
    expect(lastListParams()).toEqual({ type: "Income", sort: "date", order: "desc", page: "1" });
  });

  it("o filtro aplicado fica marcado e deixa de ficar ao mudar um controle", async () => {
    seed([{ name: "Receitas", state: { type: "Income" } }]);
    await renderLoaded();
    chooseFilter("Receitas");
    await waitFor(() => expect(lastListParams()["type"]).toBe("Income"));
    openMenu();
    expect(appliedNames()).toEqual(["Receitas"]);
    await chooseOption("Tipo", "Despesa");
    await waitFor(() => expect(lastListParams()["type"]).toBe("Expense"));
    openMenu();
    expect(appliedNames()).toEqual([]);
  });

  it("salvar com 25 itens por página não guarda o tamanho no filtro", async () => {
    await renderLoaded();
    await chooseOption("Itens por página", "25");
    await waitFor(() => expect(lastListParams()["pageSize"]).toBe("25"));
    fireEvent.change(search(), { target: { value: "mercado" } });
    await advance(300);
    await waitFor(() => expect(lastListParams()["q"]).toBe("mercado"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar filtro" }));
    fireEvent.change(screen.getByLabelText("Nome do filtro"), { target: { value: "Mercado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(toast.success).toHaveBeenCalledExactlyOnceWith('Filtro "Mercado" salvo');
    const [entry] = JSON.parse(localStorage.getItem(KEY) ?? "{}").filters;
    expect(entry.state).toEqual({ q: "mercado", sort: "date", order: "desc" });
  });

  it("aplicar um filtro com 25 itens por página escolhidos mantém o pageSize=25 na página 1", async () => {
    seed([{ name: "Mercado", state: { q: "mercado" } }]);
    await renderLoaded();
    await chooseOption("Itens por página", "25");
    await waitFor(() => expect(lastListParams()["pageSize"]).toBe("25"));
    chooseFilter("Mercado");
    await waitFor(() =>
      expect(lastListParams()).toEqual({
        q: "mercado",
        sort: "date",
        order: "desc",
        pageSize: "25",
        page: "1",
      }),
    );
  });

  it("salvar, aplicar, renomear e excluir não enviam nenhuma requisição além das consultas de sempre", async () => {
    seed([{ name: "Mensal", state: { type: "Income" } }]);
    await renderLoaded();
    await chooseOption("Tipo", "Despesa");
    fireEvent.click(screen.getByRole("button", { name: "Salvar filtro" }));
    fireEvent.change(screen.getByLabelText("Nome do filtro"), { target: { value: "Despesas" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    chooseFilter("Mensal");
    openMenu();
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Gerenciar filtros" }), {
      key: "Enter",
    });
    const dialog = screen.getByRole("dialog", { name: "Gerenciar filtros" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Renomear Despesas" }));
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Gastos" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar nome" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir Mensal" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }),
    );
    expect(toast.success).toHaveBeenCalledTimes(3);
    await act(async () => {});
    const sent = requests.map((request) => `${request.method} ${request.path.split("?")[0]}`);
    expect(new Set(sent)).toEqual(
      new Set([
        "GET /transactions",
        "GET /transactions/summary",
        "GET /accounts",
        "GET /categories",
      ]),
    );
  });

  it("com o período invertido o botão Salvar filtro fica desabilitado, e volta ao corrigir o período", async () => {
    await renderLoaded();
    pickDate("De", "2026-06-20");
    pickDate("Até", "2026-06-10");
    await screen.findByText("A data inicial deve ser anterior à final");
    expect(screen.getByRole("button", { name: "Salvar filtro" })).toBeDisabled();
    pickDate("Até", "2026-06-25");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Salvar filtro" })).toBeEnabled(),
    );
  });

  it("'Limpar filtros' mantém os filtros salvos no menu", async () => {
    seed([{ name: "Mensal", state: { type: "Income" } }]);
    await renderLoaded();
    chooseFilter("Mensal");
    await waitFor(() => expect(lastListParams()["type"]).toBe("Income"));
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(lastListParams()["type"]).toBeUndefined());
    openMenu();
    expect(screen.getByRole("menuitem", { name: "Mensal" })).toBeInTheDocument();
  });
});

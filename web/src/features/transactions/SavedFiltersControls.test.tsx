import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountsQueryOptions } from "@/features/accounts/hooks";
import { categoriesQueryOptions } from "@/features/categories/hooks";
import { mockRequest } from "@/lib/api/mock";
import type { Account, Category } from "@/lib/api/types";
import { failures, requests, resetSpy } from "@/test/apiSpy";
import { SavedFiltersControls } from "./SavedFiltersControls";
import type { FilterState } from "./utils";

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
const STORAGE_MESSAGE =
  "Não foi possível acessar o armazenamento do navegador. Verifique se ele está liberado e tente de novo.";
const INITIAL: FilterState = { filters: { sort: "date", order: "desc", page: 1 }, quick: {} };
const withFilters = (filters: FilterState["filters"], quick: FilterState["quick"] = {}) => ({
  filters: { sort: "date" as const, order: "desc" as const, page: 1, ...filters },
  quick,
});
const seed = (filters: Array<{ name: string; state: object }>) =>
  localStorage.setItem(
    KEY,
    JSON.stringify({
      version: 1,
      filters: filters.map(({ name, state }) => ({ id: `id-${name}`, name, state })),
    }),
  );
const stored = () =>
  JSON.parse(localStorage.getItem(KEY) ?? '{"filters":[]}').filters as Array<{
    name: string;
    state: object;
  }>;

let account: Account;
let inactive: Account;
let category: Category;
beforeEach(async () => {
  user.id = "u1";
  localStorage.clear();
  const accounts = await mockRequest<Account[]>({ method: "GET", path: "/accounts" });
  [account, inactive] = [accounts[0] as Account, accounts[1] as Account];
  category = (await mockRequest<Category[]>({ method: "GET", path: "/categories" }))[0] as Category;
});
afterEach(async () => {
  cleanup();
  resetSpy();
  vi.restoreAllMocks();
  localStorage.clear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.info).mockClear();
  await mockRequest({ method: "POST", path: `/accounts/${inactive.id}/activate` });
});

function Host({
  initial,
  invalidPeriod,
  onApply,
}: {
  initial: FilterState;
  invalidPeriod: boolean;
  onApply: (next: FilterState) => void;
}) {
  const [state, setState] = useState(initial);
  return (
    <>
      <SavedFiltersControls
        state={state}
        invalidPeriod={invalidPeriod}
        onApply={(next) => {
          onApply(next);
          setState(next);
        }}
      />
      <button
        onClick={() => setState((s) => ({ ...s, filters: { ...s.filters, type: "Expense" } }))}
      >
        trocar tipo
      </button>
      <button onClick={() => setState((s) => ({ ...s, filters: { ...s.filters, page: 2 } }))}>
        ir para a página 2
      </button>
    </>
  );
}
/** Mounts the controls; the account and category lists are already in the cache unless `lists` is false. */
async function mount(
  options: { initial?: FilterState; invalidPeriod?: boolean; lists?: boolean } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (options.lists !== false) {
    await client.prefetchQuery(accountsQueryOptions());
    await client.prefetchQuery(categoriesQueryOptions());
  }
  const onApply = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <Host
        initial={options.initial ?? INITIAL}
        invalidPeriod={options.invalidPeriod ?? false}
        onApply={onApply}
      />
    </QueryClientProvider>,
  );
  return { onApply, ...view };
}

const saveButton = () => screen.getByRole("button", { name: "Salvar filtro" });
const menuButton = () => screen.getByRole("button", { name: "Filtros salvos" });
const openMenu = () => {
  menuButton().focus();
  fireEvent.keyDown(menuButton(), { key: "Enter" });
};
const closeMenu = () => fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
const chooseFilter = (name: string | RegExp) => {
  openMenu();
  fireEvent.keyDown(screen.getByRole("menuitem", { name }), { key: "Enter" });
};
const openManage = () => {
  openMenu();
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Gerenciar filtros" }), { key: "Enter" });
  return screen.getByRole("dialog", { name: "Gerenciar filtros" });
};
const appliedNames = () =>
  screen
    .getAllByRole("menuitem")
    .filter((item) => item.getAttribute("aria-current") === "true")
    .map((item) => item.textContent?.replace("(aplicado)", ""));
const confirmDelete = () =>
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));

describe("SavedFiltersControls", () => {
  it("sem id de usuário não renderiza nada", async () => {
    user.id = null;
    await mount();
    // only the host's own two buttons are there
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "trocar tipo",
      "ir para a página 2",
    ]);
  });

  it.each([
    ["o estado inicial", INITIAL, false, false],
    ["só o ano do mês rápido", { ...INITIAL, quick: { year: 2026 } }, false, false],
    ["só o mês do mês rápido", { ...INITIAL, quick: { month: 6 } }, false, false],
    [
      "um período invertido",
      withFilters({ from: "2026-06-10", to: "2026-06-01", type: "Income" }),
      true,
      false,
    ],
    ["um filtro de tipo", withFilters({ type: "Income" }), false, true],
    ["só a ordenação por nome", withFilters({ sort: "name" }), false, true],
    ["só o sentido crescente", withFilters({ order: "asc" }), false, true],
  ])(
    "o botão Salvar filtro com %s: habilitado = %s",
    async (_n, initial, invalidPeriod, enabled) => {
      await mount({ initial, invalidPeriod });
      if (enabled) expect(saveButton()).toBeEnabled();
      else expect(saveButton()).toBeDisabled();
    },
  );

  it("o resumo do diálogo traz o apelido da conta e o nome da categoria das listas em cache", async () => {
    await mount({
      initial: withFilters({
        accountId: account.id,
        categoryId: category.id,
        type: "Expense",
        q: "farm",
      }),
    });
    fireEvent.click(saveButton());
    const list = screen.getByRole("list", { name: "Filtros que serão salvos" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Busca: farm",
      "Tipo: Despesa",
      `Conta: ${account.nickname}`,
      `Categoria: ${category.name}`,
      "Ordenação: Data (decrescente)",
    ]);
  });

  it("sem as listas carregadas o resumo usa Conta selecionada e Categoria selecionada", async () => {
    failures.set("GET /accounts", new Error("falha"));
    failures.set("GET /categories", new Error("falha"));
    await mount({
      initial: withFilters({ accountId: account.id, categoryId: category.id }),
      lists: false,
    });
    fireEvent.click(saveButton());
    const lines = within(screen.getByRole("list", { name: "Filtros que serão salvos" }))
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(lines).toEqual([
      "Conta: Conta selecionada",
      "Categoria: Categoria selecionada",
      "Ordenação: Data (decrescente)",
    ]);
  });

  it("salvar mostra o toast, guarda na chave do usuário sem a página, marca o filtro como aplicado e não aplica nada", async () => {
    const { onApply } = await mount({
      initial: withFilters({ type: "Income", sort: "amount", order: "asc", page: 3 }),
    });
    fireEvent.click(saveButton());
    fireEvent.change(screen.getByLabelText("Nome do filtro"), {
      target: { value: "Receitas por valor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(toast.success).toHaveBeenCalledExactlyOnceWith('Filtro "Receitas por valor" salvo');
    expect(stored()).toEqual([
      {
        id: expect.any(String),
        name: "Receitas por valor",
        state: { type: "Income", sort: "amount", order: "asc" },
      },
    ]);
    expect(onApply).not.toHaveBeenCalled();
    openMenu();
    expect(appliedNames()).toEqual(["Receitas por valor"]);
  });

  it("salvar com um mês rápido completo guarda o quick (os dias vêm do mês) e aplicar de novo traz o mês", async () => {
    const { onApply } = await mount({
      initial: withFilters({ from: "2026-06-01", to: "2026-06-30" }, { year: 2026, month: 6 }),
    });
    fireEvent.click(saveButton());
    fireEvent.change(screen.getByLabelText("Nome do filtro"), { target: { value: "Junho" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    const [entry] = stored() as Array<{ state: Record<string, unknown> }>;
    expect(entry?.state["quick"]).toEqual({ year: 2026, month: 6 });
    // the days stored are the month's own (monthRange), so a hand-edited quick/from mismatch cannot survive
    expect(entry?.state).toMatchObject({ from: "2026-06-01", to: "2026-06-30" });
    chooseFilter(/Junho/);
    expect(onApply.mock.calls[0]?.[0]).toMatchObject({
      filters: { from: "2026-06-01", to: "2026-06-30" },
      quick: { year: 2026, month: 6 },
    });
  });

  it("uma falha do armazenamento ao salvar mostra o toast de erro e mantém o diálogo aberto", async () => {
    await mount({ initial: withFilters({ type: "Income" }) });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    fireEvent.click(saveButton());
    fireEvent.change(screen.getByLabelText("Nome do filtro"), { target: { value: "Receitas" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(STORAGE_MESSAGE);
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Salvar filtro" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do filtro")).toHaveValue("Receitas");
  });

  it("aplicar entrega ao extrato o estado completo do filtro salvo, na página 1, sem nada do estado anterior", async () => {
    seed([
      {
        name: "Completo",
        state: {
          q: "farmácia",
          type: "Expense",
          accountId: account.id,
          categoryId: category.id,
          neutral: false,
          from: "2026-05-02",
          to: "2026-05-20",
          sort: "amount",
          order: "asc",
          page: 9,
        },
      },
    ]);
    const { onApply } = await mount({
      initial: withFilters(
        { type: "Income", from: "2026-01-01", to: "2026-01-31", page: 3, pageSize: 25 },
        { year: 2026, month: 1 },
      ),
    });
    chooseFilter("Completo");
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0]?.[0]).toEqual({
      filters: {
        q: "farmácia",
        type: "Expense",
        accountId: account.id,
        categoryId: category.id,
        neutral: false,
        from: "2026-05-02",
        to: "2026-05-20",
        sort: "amount",
        order: "asc",
        page: 1,
      },
      quick: {},
    });
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("aplicar um filtro com mês rápido entrega o mês e os dias dele, e sem ordenação guardada vale data decrescente", async () => {
    seed([{ name: "Fevereiro", state: { quick: { year: 2026, month: 2 } } }]);
    const { onApply } = await mount({ initial: withFilters({ type: "Income" }) });
    chooseFilter("Fevereiro");
    expect(onApply.mock.calls[0]?.[0]).toEqual({
      filters: { from: "2026-02-01", to: "2026-02-28", sort: "date", order: "desc", page: 1 },
      quick: { year: 2026, month: 2 },
    });
  });

  it.each([
    ["só a conta", { accountId: "sumiu" }, "a conta que não existe mais", ["categoryId"]],
    ["só a categoria", { categoryId: "sumiu" }, "a categoria que não existe mais", ["accountId"]],
    [
      "as duas",
      { accountId: "sumiu", categoryId: "sumiu" },
      "a conta e a categoria que não existem mais",
      [],
    ],
  ])("quando %s não existe mais, aplica o resto e avisa", async (_n, gone, what, kept) => {
    seed([
      {
        name: "Antigo",
        state: { type: "Expense", accountId: account.id, categoryId: category.id, ...gone },
      },
    ]);
    const { onApply } = await mount();
    chooseFilter("Antigo");
    const applied = (onApply.mock.calls[0]?.[0] as FilterState).filters;
    expect(applied.type).toBe("Expense");
    for (const key of ["accountId", "categoryId"] as const) {
      if ((kept as readonly string[]).includes(key)) expect(applied[key]).toBeDefined();
      else expect(applied[key]).toBeUndefined();
    }
    expect(toast.info).toHaveBeenCalledExactlyOnceWith(`Filtro "Antigo" aplicado sem ${what}`);
    expect(stored()[0]?.state).toMatchObject({ accountId: expect.any(String) });
  });

  it("uma conta inativa conta como existente e é mantida, sem aviso", async () => {
    await mockRequest({ method: "POST", path: `/accounts/${inactive.id}/deactivate` });
    seed([{ name: "Da inativa", state: { accountId: inactive.id } }]);
    const { onApply } = await mount();
    chooseFilter("Da inativa");
    expect((onApply.mock.calls[0]?.[0] as FilterState).filters.accountId).toBe(inactive.id);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("com as listas ainda não carregadas ou com erro aplica o filtro inteiro, sem aviso", async () => {
    failures.set("GET /accounts", new Error("falha"));
    failures.set("GET /categories", new Error("falha"));
    seed([{ name: "Antigo", state: { accountId: "sumiu", categoryId: "sumiu" } }]);
    const { onApply } = await mount({ lists: false });
    chooseFilter("Antigo");
    expect((onApply.mock.calls[0]?.[0] as FilterState).filters).toMatchObject({
      accountId: "sumiu",
      categoryId: "sumiu",
    });
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("o marcador acompanha o estado: igual marca, diferente tira, só a página não mexe, e iguais ficam todos marcados", async () => {
    seed([
      { name: "Receitas", state: { type: "Income" } },
      { name: "Gêmeo", state: { type: "Income" } },
      { name: "Despesas", state: { type: "Expense" } },
    ]);
    await mount({ initial: withFilters({ type: "Income" }) });
    openMenu();
    expect(appliedNames()).toEqual(["Gêmeo", "Receitas"]);
    closeMenu();
    fireEvent.click(screen.getByRole("button", { name: "ir para a página 2" }));
    openMenu();
    expect(appliedNames()).toEqual(["Gêmeo", "Receitas"]);
    closeMenu();
    fireEvent.click(screen.getByRole("button", { name: "trocar tipo" }));
    openMenu();
    expect(appliedNames()).toEqual(["Despesas"]);
  });

  it("renomear mostra o toast, o filtro aplicado mantém o marcador e o menu traz o novo nome", async () => {
    seed([{ name: "Mensal", state: { type: "Income" } }]);
    await mount({ initial: withFilters({ type: "Income" }) });
    const dialog = openManage();
    fireEvent.click(within(dialog).getByRole("button", { name: "Renomear Mensal" }));
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Entradas" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar nome" }));
    expect(toast.success).toHaveBeenCalledExactlyOnceWith('Filtro renomeado para "Entradas"');
    fireEvent.keyDown(dialog, { key: "Escape" });
    openMenu();
    expect(appliedNames()).toEqual(["Entradas"]);
  });

  it("excluir mostra o toast, não aplica nada e o filtro aplicado deixa de existir sem marcar outro", async () => {
    seed([
      { name: "Mensal", state: { type: "Income" } },
      { name: "Outro", state: { type: "Expense" } },
    ]);
    const { onApply } = await mount({ initial: withFilters({ type: "Income" }) });
    const dialog = openManage();
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir Mensal" }));
    confirmDelete();
    expect(toast.success).toHaveBeenCalledExactlyOnceWith('Filtro "Mensal" excluído');
    expect(onApply).not.toHaveBeenCalled();
    expect(stored().map((filter) => filter.name)).toEqual(["Outro"]);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Gerenciar filtros" }), {
      key: "Escape",
    });
    openMenu();
    expect(appliedNames()).toEqual([]);
  });

  it("uma falha do armazenamento ao renomear ou excluir mostra o toast de erro e mantém a lista", async () => {
    seed([{ name: "Mensal", state: { type: "Income" } }]);
    await mount();
    const dialog = openManage();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Renomear Mensal" }));
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Novo" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar nome" }));
    expect(toast.error).toHaveBeenLastCalledWith(STORAGE_MESSAGE);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir Mensal" }));
    confirmDelete();
    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenLastCalledWith(STORAGE_MESSAGE);
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("um filtro apagado em outra aba mostra 'Esse filtro não existe mais' ao renomear e ao excluir", async () => {
    seed([
      { name: "Mensal", state: { type: "Income" } },
      { name: "Viagem", state: { type: "Expense" } },
    ]);
    await mount();
    const dialog = openManage();
    fireEvent.click(within(dialog).getByRole("button", { name: "Renomear Mensal" }));
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Novo" } });
    seed([{ name: "Viagem", state: { type: "Expense" } }]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar nome" }));
    expect(toast.error).toHaveBeenLastCalledWith("Esse filtro não existe mais");
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir Viagem" }));
    seed([]);
    confirmDelete();
    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenLastCalledWith("Esse filtro não existe mais");
    expect(within(dialog).getByText("Nenhum filtro salvo ainda")).toBeInTheDocument();
  });

  it("fechar o gerenciador devolve o foco ao botão Filtros salvos", async () => {
    seed([{ name: "Mensal", state: { type: "Income" } }]);
    await mount();
    const dialog = openManage();
    // the menu gives the focus back to its button in a task of its own; let it run before closing
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(menuButton()).toHaveFocus());
  });

  it("com 20 filtros salvos o diálogo de salvar mostra o limite e não deixa salvar", async () => {
    seed(Array.from({ length: 20 }, (_, i) => ({ name: `Filtro ${i + 1}`, state: { q: `${i}` } })));
    await mount({ initial: withFilters({ type: "Income" }) });
    fireEvent.click(saveButton());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Limite de 20 filtros salvos atingido. Exclua um para salvar outro.",
    );
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("salvar, aplicar, renomear e excluir não enviam nenhuma requisição à API", async () => {
    seed([{ name: "Mensal", state: { type: "Income" } }]);
    await mount({ initial: withFilters({ type: "Expense" }) });
    const before = requests.length;
    chooseFilter("Mensal");
    fireEvent.click(saveButton());
    fireEvent.change(screen.getByLabelText("Nome do filtro"), { target: { value: "Outro" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(requests.slice(before)).toEqual([]);
  });
});

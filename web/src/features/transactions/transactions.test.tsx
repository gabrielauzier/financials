import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { GENERIC_ERROR } from "@/lib/api/errorMessages";
import { mockRequest } from "@/lib/api/mock";
import type {
  Account,
  Category,
  Transaction,
  TransactionsPage as TransactionsPageData,
} from "@/lib/api/types";
import { TransactionForm } from "./TransactionForm";
import { TransactionsPage } from "./TransactionsPage";
import { parseBRLToDecimal, toLocalDateInput } from "./utils";
import { formatDateLocal } from "@/lib/format";

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

const failures = vi.hoisted(() => new Map<string, unknown>());
const requests = vi.hoisted(() => [] as Array<{ method: string; path: string; body: unknown }>);
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: async (path: string, options: { method?: string; body?: unknown } = {}) => {
    const method = options.method?.toUpperCase() ?? "GET";
    const key = path
      .split("?")[0]
      ?.replace(/^\/transactions\/(?!category$)[^/]+/, "/transactions/:id");
    requests.push({ method, path, body: options.body });
    const failure = failures.get(`${method} ${key}`);
    if (failure) throw failure;
    return mockRequest({ method, path, body: options.body });
  },
}));

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
  failures.clear();
  requests.length = 0;
  vi.useRealTimers();
});

describe("extrato", () => {
  it("converte valores brasileiros sem aritmética de ponto flutuante", () => {
    expect(parseBRLToDecimal("1.234,56")).toBe("1234.56");
    expect(parseBRLToDecimal("0,00")).toBeNull();
    expect(parseBRLToDecimal("12,345")).toBeNull();
  });

  it("converte o instante para a data local do navegador", () => {
    const previousTimezone = process.env["TZ"];
    process.env["TZ"] = "America/Sao_Paulo";
    expect(toLocalDateInput("2026-10-05T01:00:00Z")).toBe("2026-10-04");
    expect(formatDateLocal("2026-10-05T01:00:00Z")).toBe("04/10/2026");
    process.env["TZ"] = previousTimezone;
  });

  it("conecta transações às contas e categorias do mock", async () => {
    const previousTimezone = process.env["TZ"];
    process.env["TZ"] = "America/Sao_Paulo";
    const createdAccount = await mockRequest<Account>({
      method: "POST",
      path: "/accounts",
      body: { bank: "Neon", nickname: "Conta nova", holderNames: ["Gabriel"] },
    });
    const createdCategory = await mockRequest<Category>({
      method: "POST",
      path: "/categories",
      body: { name: "Categoria nova" },
    });
    const created = await mockRequest<Transaction>({
      method: "POST",
      path: "/transactions",
      body: {
        name: "Teste integrado",
        type: "Expense",
        occurredAt: "2026-10-05T01:00:00Z",
        amount: "10.00",
        accountId: createdAccount.id,
        categoryId: createdCategory.id,
        paymentMethod: "PIX",
      },
    });
    expect(created).toMatchObject({
      accountNickname: "Conta nova",
      categoryName: "Categoria nova",
    });
    await mockRequest({
      method: "PATCH",
      path: `/categories/${createdCategory.id}`,
      body: { name: "Categoria renomeada" },
    });
    const page = await mockRequest<TransactionsPageData>({
      method: "GET",
      path: `/transactions?categoryId=${createdCategory.id}`,
    });
    expect(page.items[0]?.categoryName).toBe("Categoria renomeada");
    const localDay = await mockRequest<TransactionsPageData>({
      method: "GET",
      path: `/transactions?from=2026-10-04&to=2026-10-04&q=Teste integrado`,
    });
    expect(localDay.items).toHaveLength(1);
    process.env["TZ"] = previousTimezone;
  });

  it("valida relações e reatribui transações ao excluir uma categoria", async () => {
    const source = await mockRequest<Category>({
      method: "POST",
      path: "/categories",
      body: { name: "Origem temporária" },
    });
    await mockRequest<Transaction>({
      method: "POST",
      path: "/transactions",
      body: {
        name: "Uso da categoria",
        type: "Expense",
        occurredAt: "2026-10-05T12:00:00Z",
        amount: "12.00",
        accountId: account.id,
        categoryId: source.id,
        paymentMethod: "PIX",
      },
    });
    await expect(
      mockRequest({ method: "DELETE", path: `/categories/${source.id}` }),
    ).rejects.toMatchObject({ code: "reassign_required", status: 422 });
    await mockRequest({
      method: "DELETE",
      path: `/categories/${source.id}?reassignTo=${category.id}`,
    });
    const reassigned = await mockRequest<TransactionsPageData>({
      method: "GET",
      path: `/transactions?q=Uso da categoria`,
    });
    expect(reassigned.items[0]?.categoryId).toBe(category.id);
    await expect(
      mockRequest({
        method: "POST",
        path: "/transactions",
        body: {
          name: "Categoria inválida",
          type: "Expense",
          occurredAt: "2026-10-05T12:00:00Z",
          amount: "1.00",
          accountId: account.id,
          categoryId: "inexistente",
          paymentMethod: "PIX",
        },
      }),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
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

  describe("erros da API em português", () => {
    const seeded = () => {
      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: Infinity },
          mutations: { retry: false },
        },
      });
      client.setQueryData(["accounts", { active: true }], [account]);
      client.setQueryData(["categories"], [category]);
      return client;
    };
    const fillAndSubmit = async () => {
      fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Mercado" } });
      fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "10,00" } });
      fireEvent.click(screen.getByLabelText("Conta"));
      fireEvent.click(await screen.findByRole("option", { name: "Nubank pessoal" }));
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    };

    it("mostra no campo valor a mensagem de invalid_amount com field amount", async () => {
      renderQuery(<TransactionForm open onOpenChange={vi.fn()} />, seeded());
      failures.set(
        "POST /transactions",
        new ApiError("invalid_amount", "Amount must be positive", 422, "amount"),
      );
      await fillAndSubmit();
      const alert = await screen.findByText("Valor inválido");
      expect(alert).toHaveAttribute("id", "transaction-amount-error");
      expect(screen.queryByText("Amount must be positive")).not.toBeInTheDocument();
    });

    it("mostra invalid_account no campo conta e occurredAt no campo data", async () => {
      renderQuery(<TransactionForm open onOpenChange={vi.fn()} />, seeded());
      failures.set(
        "POST /transactions",
        new ApiError("invalid_account", "Inactive account", 422, "accountId"),
      );
      await fillAndSubmit();
      expect(await screen.findByText("Selecione uma conta ativa")).toHaveAttribute(
        "id",
        "transaction-account-error",
      );
      failures.set(
        "POST /transactions",
        new ApiError("validation_error", "Bad date", 422, "occurredAt"),
      );
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
      expect(await screen.findByText("Dados inválidos. Revise os campos")).toHaveAttribute(
        "id",
        "transaction-date-error",
      );
    });

    it("mostra no alerta do formulário o erro sem campo e o texto genérico", async () => {
      renderQuery(<TransactionForm open onOpenChange={vi.fn()} />, seeded());
      failures.set("POST /transactions", new ApiError("unauthorized", "Token expired", 401));
      await fillAndSubmit();
      expect(await screen.findByText("Sua sessão expirou. Entre novamente")).toHaveAttribute(
        "role",
        "alert",
      );
      failures.set("POST /transactions", new ApiError("brand_new_code", "Kaboom", 500));
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
      expect(await screen.findByText(GENERIC_ERROR)).toBeInTheDocument();
      expect(screen.queryByText("Kaboom")).not.toBeInTheDocument();
    });

    it("mostra not_found em português quando a atualização em lote falha", async () => {
      renderQuery(<TransactionsPage />);
      await screen.findByLabelText("Selecionar todas da página");
      // let the initial search debounce (300 ms) settle: it resets the selection
      await new Promise((resolve) => setTimeout(resolve, 350));
      fireEvent.click(screen.getByLabelText("Selecionar todas da página"));
      const bar = (await screen.findByText(/selecionada\(s\)/)).parentElement as HTMLElement;
      fireEvent.click(within(bar).getByRole("combobox"));
      fireEvent.click((await screen.findAllByRole("option"))[0] as HTMLElement);
      failures.set("PATCH /transactions/category", new ApiError("not_found", "Missing ids", 404));
      fireEvent.click(within(bar).getByRole("button", { name: "Aplicar categoria" }));
      expect(
        await screen.findByText("Registro não encontrado. Atualize a página e tente de novo"),
      ).toBeInTheDocument();
      expect(screen.queryByText("Missing ids")).not.toBeInTheDocument();
    });

    it("mostra em português a falha ao excluir", async () => {
      renderQuery(<TransactionsPage />);
      const [firstDelete] = await screen.findAllByRole("button", { name: /^Excluir / });
      fireEvent.click(firstDelete as HTMLElement);
      failures.set("DELETE /transactions/:id", new ApiError("internal_error", "DB down", 500));
      const dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
      expect(await screen.findByText(GENERIC_ERROR)).toBeInTheDocument();
      expect(screen.queryByText("DB down")).not.toBeInTheDocument();
    });
  });

  describe("edição e criação de observações e recibo", () => {
    const seedEditable = async (notes: string | null, receipt: string | null) => {
      const page = await mockRequest<TransactionsPageData>({
        method: "GET",
        path: "/transactions?page=1",
      });
      const base = page.items.find((item) => !item.neutral) as Transaction;
      return mockRequest<Transaction>({
        method: "PATCH",
        path: `/transactions/${base.id}`,
        body: { notes, receipt },
      });
    };
    const patchBody = () =>
      requests.find(
        (request) => request.method === "PATCH" && /^\/transactions\/[^/]+$/.test(request.path),
      )?.body as Record<string, unknown>;
    const submitEdit = async (item: Transaction) => {
      renderQuery(<TransactionForm open onOpenChange={vi.fn()} transaction={item} />);
      await waitFor(() => expect(screen.getByLabelText("Nome")).toHaveValue(item.name));
    };

    it("envia notes null e mostra a transação sem observações ao esvaziar as observações", async () => {
      const item = await seedEditable("Observação antiga", "https://exemplo.com/r.pdf");
      await submitEdit(item);
      fireEvent.change(screen.getByLabelText("Observações"), { target: { value: "   " } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
      await waitFor(() => expect(patchBody()).toBeDefined());
      expect(patchBody()).toHaveProperty("notes", null);
      expect(patchBody()).toHaveProperty("receipt", "https://exemplo.com/r.pdf");
      const after = await mockRequest<TransactionsPageData>({
        method: "GET",
        path: `/transactions?q=${encodeURIComponent(item.name)}`,
      });
      expect(after.items.find((row) => row.id === item.id)?.notes).toBeNull();
    });

    it("envia receipt null ao esvaziar o recibo e preserva as observações intocadas", async () => {
      const item = await seedEditable("Manter", "https://exemplo.com/r.pdf");
      await submitEdit(item);
      fireEvent.change(screen.getByLabelText("Recibo (URL)"), { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
      await waitFor(() => expect(patchBody()).toBeDefined());
      expect(patchBody()).toHaveProperty("receipt", null);
      expect(patchBody()).toHaveProperty("notes", "Manter");
    });

    it("envia o texto sem espaços nas pontas ao preencher na edição", async () => {
      const item = await seedEditable(null, null);
      await submitEdit(item);
      fireEvent.change(screen.getByLabelText("Observações"), {
        target: { value: "  nova nota  " },
      });
      fireEvent.change(screen.getByLabelText("Recibo (URL)"), {
        target: { value: "  https://exemplo.com/novo.pdf  " },
      });
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
      await waitFor(() => expect(patchBody()).toBeDefined());
      expect(patchBody()).toMatchObject({
        notes: "nova nota",
        receipt: "https://exemplo.com/novo.pdf",
      });
    });

    it("omite observações e recibo vazios ao criar", async () => {
      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: Infinity },
          mutations: { retry: false },
        },
      });
      client.setQueryData(["accounts", { active: true }], [account]);
      client.setQueryData(["categories"], [category]);
      renderQuery(<TransactionForm open onOpenChange={vi.fn()} />, client);
      fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Sem extras" } });
      fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "10,00" } });
      fireEvent.change(screen.getByLabelText("Observações"), { target: { value: "  " } });
      fireEvent.click(screen.getByLabelText("Conta"));
      fireEvent.click(await screen.findByRole("option", { name: "Nubank pessoal" }));
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
      await waitFor(() =>
        expect(
          requests.some((request) => request.method === "POST" && request.path === "/transactions"),
        ).toBe(true),
      );
      const body = requests.find((request) => request.method === "POST")?.body as Record<
        string,
        unknown
      >;
      expect(body).not.toHaveProperty("notes");
      expect(body).not.toHaveProperty("receipt");
    });
  });

  describe("período do filtro", () => {
    const listPaths = () =>
      requests
        .filter((r) => r.method === "GET" && r.path.startsWith("/transactions?"))
        .map((r) => r.path);
    const setPeriod = (from: string, to: string) => {
      fireEvent.change(screen.getByLabelText("De"), { target: { value: from } });
      fireEvent.change(screen.getByLabelText("Até"), { target: { value: to } });
    };

    it("avisa e não consulta a API quando a data inicial é depois da final", async () => {
      renderQuery(<TransactionsPage />);
      await screen.findByLabelText("Selecionar todas da página");
      setPeriod("2026-10-10", "2026-10-01");
      expect(
        await screen.findByText("A data inicial deve ser anterior à final"),
      ).toBeInTheDocument();
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(
        listPaths().filter(
          (path) => path.includes("from=2026-10-10") && path.includes("to=2026-10-01"),
        ),
      ).toEqual([]);
    });

    it("consulta normalmente com datas iguais e com um período válido", async () => {
      renderQuery(<TransactionsPage />);
      await screen.findByLabelText("Selecionar todas da página");
      setPeriod("2026-10-05", "2026-10-05");
      await waitFor(() =>
        expect(
          listPaths().some((p) => p.includes("from=2026-10-05") && p.includes("to=2026-10-05")),
        ).toBe(true),
      );
      expect(
        screen.queryByText("A data inicial deve ser anterior à final"),
      ).not.toBeInTheDocument();
      setPeriod("2026-10-01", "2026-10-31");
      await waitFor(() =>
        expect(
          listPaths().some((p) => p.includes("from=2026-10-01") && p.includes("to=2026-10-31")),
        ).toBe(true),
      );
      expect(
        screen.queryByText("A data inicial deve ser anterior à final"),
      ).not.toBeInTheDocument();
    });
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockRequest } from "@/lib/api/mock";
import type {
  Account,
  Category,
  Transaction,
  TransactionFilters,
  TransactionsPage,
  TransactionSummary,
} from "@/lib/api/types";
import { failures, requests, resetSpy } from "@/test/apiSpy";
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactionSummary,
  useUpdateTransaction,
  useUpdateTransactionCategories,
} from "./hooks";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
});

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

const summaryRequests = () =>
  requests.filter((request) => request.path.startsWith("/transactions/summary"));
const summaryParams = (index = -1) =>
  Object.fromEntries(
    new URLSearchParams(summaryRequests().at(index)?.path.split("?")[1] ?? "").entries(),
  );
const flush = () => act(async () => {});

const firstTransaction = async () =>
  (await mockRequest<TransactionsPage>({ method: "GET", path: "/transactions" }))
    .items[0] as Transaction;

describe("useTransactionSummary: a consulta", () => {
  it("sem filtro pede /transactions/summary sem parâmetros", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useTransactionSummary({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(summaryRequests().map((request) => request.path)).toEqual(["/transactions/summary"]);
  });

  it("leva só os filtros ativos e nenhum de sort, order, page e pageSize", async () => {
    const { wrapper } = setup();
    const filters: TransactionFilters = {
      sort: "amount",
      order: "asc",
      page: 3,
      pageSize: 25,
      type: "Income",
      q: "salário",
      neutral: false,
    };
    const { result } = renderHook(() => useTransactionSummary(filters), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(summaryRequests()).toHaveLength(1);
    expect(summaryParams()).toEqual({ type: "Income", q: "salário", neutral: "false" });
    expect(result.current.data).toMatchObject({ count: expect.any(Number) });
  });

  it("não consulta com enabled falso", async () => {
    const { wrapper } = setup();
    renderHook(() => useTransactionSummary({}, false), { wrapper });
    await flush();
    expect(summaryRequests()).toHaveLength(0);
  });
});

describe("useTransactionSummary: quando refaz a consulta", () => {
  it("mudar só a página, a ordenação ou o tamanho não consulta de novo; mudar um filtro consulta", async () => {
    const { wrapper } = setup();
    const { result, rerender } = renderHook(
      (filters: TransactionFilters) => useTransactionSummary(filters),
      { wrapper, initialProps: { sort: "date", order: "desc", page: 1 } as TransactionFilters },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(summaryRequests()).toHaveLength(1);

    rerender({ sort: "date", order: "desc", page: 2 });
    await flush();
    rerender({ sort: "amount", order: "asc", page: 2 });
    await flush();
    rerender({ sort: "amount", order: "asc", page: 1, pageSize: 100 });
    await flush();
    expect(summaryRequests()).toHaveLength(1);
    expect(result.current.isSuccess).toBe(true);

    rerender({ sort: "amount", order: "asc", page: 1, pageSize: 100, type: "Expense" });
    await waitFor(() => expect(summaryRequests()).toHaveLength(2));
    expect(summaryParams()).toEqual({ type: "Expense" });
  });
});

describe("useTransactionSummary: falha e nova tentativa", () => {
  it("expõe o erro e refetch repete só a consulta do resumo", async () => {
    const { wrapper } = setup();
    failures.set("GET /transactions/summary", new Error("boom"));
    const { result } = renderHook(() => useTransactionSummary({ type: "Income" }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const before = requests.length;
    failures.clear();
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const added = requests.slice(before);
    expect(added).toHaveLength(1);
    expect(added[0]?.path).toBe("/transactions/summary?type=Income");
  });
});

describe("o resumo é refeito depois de mudar as transações", () => {
  async function mounted() {
    const env = setup();
    const summary = renderHook(() => useTransactionSummary({}), { wrapper: env.wrapper });
    await waitFor(() => expect(summary.result.current.isSuccess).toBe(true));
    expect(summaryRequests()).toHaveLength(1);
    return { ...env, summary };
  }
  const account = async () =>
    (await mockRequest<Account[]>({ method: "GET", path: "/accounts?active=true" }))[0] as Account;

  it("criar uma transação", async () => {
    const { wrapper } = await mounted();
    const create = renderHook(() => useCreateTransaction(), { wrapper });
    await act(async () => {
      await create.result.current.mutateAsync({
        name: "Resumo criar",
        type: "Expense",
        occurredAt: "2026-10-05T15:00:00.000Z",
        amount: "10.00",
        accountId: (await account()).id,
        paymentMethod: "PIX",
      });
    });
    expect(summaryRequests()).toHaveLength(2);
  });

  it("excluir uma transação", async () => {
    const { wrapper } = await mounted();
    const remove = renderHook(() => useDeleteTransaction(), { wrapper });
    await act(async () => {
      await remove.result.current.mutateAsync((await firstTransaction()).id);
    });
    expect(summaryRequests()).toHaveLength(2);
  });

  it("editar uma transação, sem estragar o resumo em cache (a atualização otimista só lê páginas)", async () => {
    const { wrapper, client, summary } = await mounted();
    const before = summary.result.current.data as TransactionSummary;
    const update = renderHook(() => useUpdateTransaction(), { wrapper });
    await act(async () => {
      await update.result.current.mutateAsync({
        id: (await firstTransaction()).id,
        input: { name: "Editada pelo resumo" },
      });
    });
    expect(summaryRequests()).toHaveLength(2);
    const cached = client.getQueryData<TransactionSummary>(["transaction-summary", {}]);
    expect(Object.keys(cached ?? {}).sort()).toEqual(Object.keys(before).sort());
    expect(cached).not.toHaveProperty("items");
  });

  it("recategorizar em lote", async () => {
    const { wrapper } = await mounted();
    const bulk = renderHook(() => useUpdateTransactionCategories(), { wrapper });
    const categories = await mockRequest<Category[]>({ method: "GET", path: "/categories" });
    await act(async () => {
      await bulk.result.current.mutateAsync({
        ids: [(await firstTransaction()).id],
        categoryId: (categories[0] as Category).id,
      });
    });
    expect(summaryRequests()).toHaveLength(2);
  });
});

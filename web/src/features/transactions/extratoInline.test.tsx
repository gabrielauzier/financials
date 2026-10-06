import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { GENERIC_ERROR } from "@/lib/api/errorMessages";
import { mockRequest } from "@/lib/api/mock";
import type { Account, Category, Transaction } from "@/lib/api/types";
import { failures, renderWithQuery, requests, resetSpy } from "@/test/apiSpy";
import { TransactionsPage } from "./TransactionsPage";

vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("sonner")>()),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
  vi.useRealTimers();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

const patches = (pattern: RegExp) =>
  requests.filter((request) => request.method === "PATCH" && pattern.test(request.path));
const singlePatches = () => patches(/^\/transactions\/(?!category$)[^/]+$/);

/** The table row of a transaction (each item is also rendered as a mobile card). */
const rowOf = async (name: string) => {
  const cells = await screen.findAllByText(name);
  return cells.find((cell) => cell.closest("tr"))?.closest("tr") as HTMLElement;
};

/** Seeds uniquely named transactions dated in 2030, so they lead the default (date desc) page. */
const seed = async (...names: string[]) => {
  const [account] = await mockRequest<Account[]>({ method: "GET", path: "/accounts?active=true" });
  const categories = await mockRequest<Category[]>({ method: "GET", path: "/categories" });
  const items: Transaction[] = [];
  for (const [index, name] of names.entries()) {
    items.push(
      await mockRequest<Transaction>({
        method: "POST",
        path: "/transactions",
        body: {
          name,
          type: "Expense",
          occurredAt: `2030-01-${String(20 - index).padStart(2, "0")}T12:00:00Z`,
          amount: "10.00",
          accountId: account?.id,
          paymentMethod: "PIX",
        },
      }),
    );
  }
  return { items, categories };
};

const chooseCategoryIn = async (container: HTMLElement, categoryName: string) => {
  fireEvent.click(within(container).getAllByRole("combobox")[0] as HTMLElement);
  fireEvent.click(await screen.findByRole("option", { name: categoryName }));
};

describe("extrato: categoria, lote e neutra", () => {
  it("salva a categoria da linha com PATCH {categoryId}, sem abrir formulário, e mostra a nova categoria", async () => {
    const {
      items: [item],
      categories,
    } = await seed("Inline categoria A");
    if (!item) throw new Error("seed");
    const target = categories.find((c) => c.id !== item.categoryId) as Category;
    renderWithQuery(<TransactionsPage />);
    const row = await rowOf(item.name);
    await chooseCategoryIn(row, target.name);
    await waitFor(() => expect(singlePatches()).toHaveLength(1));
    expect(singlePatches()[0]).toEqual({
      method: "PATCH",
      path: `/transactions/${item.id}`,
      body: { categoryId: target.id },
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(async () =>
      expect(within(await rowOf(item.name)).getAllByRole("combobox")[0]).toHaveTextContent(
        target.name,
      ),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledExactlyOnceWith("Categoria atualizada"),
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("restaura a categoria anterior e emite o toast de erro em português quando o PATCH falha", async () => {
    const {
      items: [item],
      categories,
    } = await seed("Inline categoria B");
    if (!item) throw new Error("seed");
    const target = categories.find((c) => c.id !== item.categoryId) as Category;
    renderWithQuery(<TransactionsPage />);
    const row = await rowOf(item.name);
    expect(within(row).getAllByRole("combobox")[0]).toHaveTextContent(item.categoryName);
    failures.set("PATCH /transactions/:id", new Error("boom"));
    await chooseCategoryIn(row, target.name);
    await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith(GENERIC_ERROR));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
    expect(singlePatches()[0]?.body).toEqual({ categoryId: target.id });
    await waitFor(async () =>
      expect(within(await rowOf(item.name)).getAllByRole("combobox")[0]).toHaveTextContent(
        item.categoryName,
      ),
    );
  });

  it("mostra o texto mapeado do ApiError not_found no toast quando o PATCH da categoria da linha falha", async () => {
    const {
      items: [item],
      categories,
    } = await seed("Inline categoria not_found");
    if (!item) throw new Error("seed");
    const target = categories.find((c) => c.id !== item.categoryId) as Category;
    renderWithQuery(<TransactionsPage />);
    const row = await rowOf(item.name);
    failures.set("PATCH /transactions/:id", new ApiError("not_found", "Missing row", 404));
    await chooseCategoryIn(row, target.name);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledExactlyOnceWith(
        "Registro não encontrado. Atualize a página e tente de novo",
      ),
    );
    expect(toast.error).not.toHaveBeenCalledWith("Missing row");
    expect(toast.success).not.toHaveBeenCalled();
  });

  const selectTwo = async (names: string[]) => {
    renderWithQuery(<TransactionsPage />);
    await rowOf(names[0] as string);
    for (const name of names) {
      fireEvent.click(within(await rowOf(name)).getByRole("checkbox"));
    }
    return (await screen.findByText(/selecionada\(s\)/)).parentElement as HTMLElement;
  };

  it("aplica a categoria a duas linhas com uma única chamada PATCH /transactions/category", async () => {
    const {
      items: [first, second],
      categories,
    } = await seed("Inline lote A", "Inline lote B");
    if (!first || !second) throw new Error("seed");
    const target = categories.find(
      (c) => c.id !== first.categoryId && c.id !== second.categoryId,
    ) as Category;
    const bar = await selectTwo([first.name, second.name]);
    expect(within(bar).getByText("2 selecionada(s)")).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: target.name }));
    fireEvent.click(within(bar).getByRole("button", { name: "Aplicar categoria" }));
    await waitFor(() => expect(patches(/^\/transactions\/category$/)).toHaveLength(1));
    const call = patches(/^\/transactions\/category$/)[0];
    expect(call?.body).toEqual({ ids: [first.id, second.id], categoryId: target.id });
    expect(singlePatches()).toHaveLength(0);
    for (const name of [first.name, second.name]) {
      await waitFor(async () =>
        expect(within(await rowOf(name)).getAllByRole("combobox")[0]).toHaveTextContent(
          target.name,
        ),
      );
    }
    await waitFor(() => expect(screen.queryByText(/selecionada\(s\)/)).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Categoria aplicada a 2 transações");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a seleção feita logo depois de abrir a página sobrevive ao debounce da busca, sem consulta nova", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const {
      items: [item],
    } = await seed("Inline seleção cedo");
    if (!item) throw new Error("seed");
    renderWithQuery(<TransactionsPage />);
    fireEvent.click(within(await rowOf(item.name)).getByRole("checkbox"));
    expect(await screen.findByText("1 selecionada(s)")).toBeInTheDocument();
    const listsBefore = requests.filter((request) => request.path.startsWith("/transactions?"));
    // the 300 ms debounce armed at mount fires now, with the search still empty
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(screen.getByText("1 selecionada(s)")).toBeInTheDocument();
    expect(within(await rowOf(item.name)).getByRole("checkbox")).toBeChecked();
    expect(requests.filter((request) => request.path.startsWith("/transactions?"))).toHaveLength(
      listsBefore.length,
    );
  });

  it("aplica a categoria a uma única linha e emite o texto no singular", async () => {
    const {
      items: [item],
      categories,
    } = await seed("Inline lote único");
    if (!item) throw new Error("seed");
    const target = categories.find((c) => c.id !== item.categoryId) as Category;
    renderWithQuery(<TransactionsPage />);
    await rowOf(item.name);
    fireEvent.click(within(await rowOf(item.name)).getByRole("checkbox"));
    const bar = (await screen.findByText(/selecionada\(s\)/)).parentElement as HTMLElement;
    expect(within(bar).getByText("1 selecionada(s)")).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: target.name }));
    fireEvent.click(within(bar).getByRole("button", { name: "Aplicar categoria" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledExactlyOnceWith("Categoria aplicada a 1 transação"),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("mantém a seleção e as categorias antigas e emite o toast de erro em português quando o lote falha", async () => {
    const {
      items: [first, second],
      categories,
    } = await seed("Inline falha A", "Inline falha B");
    if (!first || !second) throw new Error("seed");
    const target = categories.find(
      (c) => c.id !== first.categoryId && c.id !== second.categoryId,
    ) as Category;
    const bar = await selectTwo([first.name, second.name]);
    failures.set(
      "PATCH /transactions/category",
      Object.assign(new Error("Missing ids"), { code: "not_found", status: 404 }),
    );
    fireEvent.click(within(bar).getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: target.name }));
    fireEvent.click(within(bar).getByRole("button", { name: "Aplicar categoria" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledExactlyOnceWith(
        "Registro não encontrado. Atualize a página e tente de novo",
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(patches(/^\/transactions\/category$/)).toHaveLength(1);
    expect(screen.getByText("2 selecionada(s)")).toBeInTheDocument();
    for (const [item, name] of [
      [first, first.name],
      [second, second.name],
    ] as const) {
      const row = await rowOf(name);
      expect(within(row).getByRole("checkbox")).toBeChecked();
      expect(within(row).getAllByRole("combobox")[0]).toHaveTextContent(item.categoryName);
    }
  });

  it("persiste a chave neutra com PATCH {neutral: true} e mostra o selo Neutra", async () => {
    const {
      items: [item],
    } = await seed("Inline neutra 0");
    if (!item) throw new Error("seed");
    renderWithQuery(<TransactionsPage />);
    const row = await rowOf(item.name);
    expect(within(row).queryByText("Neutra")).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole("switch", { name: `Marcar ${item.name} como neutra` }));
    await waitFor(() => expect(singlePatches()).toHaveLength(1));
    expect(singlePatches()[0]).toEqual({
      method: "PATCH",
      path: `/transactions/${item.id}`,
      body: { neutral: true },
    });
    await waitFor(async () =>
      expect(within(await rowOf(item.name)).getByText("Neutra")).toBeInTheDocument(),
    );
    expect(
      within(await rowOf(item.name)).getByRole("switch", {
        name: `Marcar ${item.name} como neutra`,
      }),
    ).toBeChecked();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("reverte a chave neutra e o selo quando o PATCH falha", async () => {
    const {
      items: [item],
    } = await seed("Inline neutra 1");
    if (!item) throw new Error("seed");
    renderWithQuery(<TransactionsPage />);
    const row = await rowOf(item.name);
    failures.set("PATCH /transactions/:id", new Error("boom"));
    fireEvent.click(within(row).getByRole("switch", { name: `Marcar ${item.name} como neutra` }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith(GENERIC_ERROR));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(singlePatches()[0]?.body).toEqual({ neutral: true });
    await waitFor(async () => {
      const current = await rowOf(item.name);
      expect(
        within(current).getByRole("switch", { name: `Marcar ${item.name} como neutra` }),
      ).not.toBeChecked();
      expect(within(current).queryByText("Neutra")).not.toBeInTheDocument();
    });
  });

  it("mostra o texto mapeado do ApiError not_found no toast quando o PATCH da chave neutra falha", async () => {
    const {
      items: [item],
    } = await seed("Inline neutra not_found");
    if (!item) throw new Error("seed");
    renderWithQuery(<TransactionsPage />);
    const row = await rowOf(item.name);
    failures.set("PATCH /transactions/:id", new ApiError("not_found", "Missing row", 404));
    fireEvent.click(within(row).getByRole("switch", { name: `Marcar ${item.name} como neutra` }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledExactlyOnceWith(
        "Registro não encontrado. Atualize a página e tente de novo",
      ),
    );
    expect(toast.error).not.toHaveBeenCalledWith("Missing row");
    expect(toast.success).not.toHaveBeenCalled();
  });

  // The refetch after a failed save (onSettled) restores the row on its own when the server is
  // reachable; offline it fails too, so only the rollback itself can bring the old value back.
  it("restaura a categoria anterior pelo rollback mesmo quando o servidor está inacessível (PATCH e recarga falham)", async () => {
    const {
      items: [item],
      categories,
    } = await seed("Inline categoria offline");
    if (!item) throw new Error("seed");
    const target = categories.find((c) => c.id !== item.categoryId) as Category;
    renderWithQuery(<TransactionsPage />);
    const row = await rowOf(item.name);
    failures.set("PATCH /transactions/:id", new TypeError("Failed to fetch"));
    failures.set("GET /transactions", new TypeError("Failed to fetch"));
    await chooseCategoryIn(row, target.name);
    await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith(GENERIC_ERROR));
    await waitFor(async () =>
      expect(within(await rowOf(item.name)).getAllByRole("combobox")[0]).toHaveTextContent(
        item.categoryName,
      ),
    );
    expect(within(await rowOf(item.name)).getAllByRole("combobox")[0]).not.toHaveTextContent(
      target.name,
    );
  });

  it("reverte a chave neutra e o selo pelo rollback mesmo quando o servidor está inacessível", async () => {
    const {
      items: [item],
    } = await seed("Inline neutra offline");
    if (!item) throw new Error("seed");
    renderWithQuery(<TransactionsPage />);
    const row = await rowOf(item.name);
    failures.set("PATCH /transactions/:id", new TypeError("Failed to fetch"));
    failures.set("GET /transactions", new TypeError("Failed to fetch"));
    fireEvent.click(within(row).getByRole("switch", { name: `Marcar ${item.name} como neutra` }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith(GENERIC_ERROR));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(async () => {
      const current = await rowOf(item.name);
      expect(
        within(current).getByRole("switch", { name: `Marcar ${item.name} como neutra` }),
      ).not.toBeChecked();
      expect(within(current).queryByText("Neutra")).not.toBeInTheDocument();
    });
  });
});

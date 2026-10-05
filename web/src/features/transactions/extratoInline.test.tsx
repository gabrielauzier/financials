import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockRequest } from "@/lib/api/mock";
import type { Account, Category, Transaction } from "@/lib/api/types";
import { failures, renderWithQuery, requests, resetSpy } from "@/test/apiSpy";
import { TransactionsPage } from "./TransactionsPage";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
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
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("restaura a categoria anterior e mostra 'Não foi possível salvar a categoria' quando o PATCH falha", async () => {
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
    expect(await screen.findByText("Não foi possível salvar a categoria")).toBeInTheDocument();
    expect(singlePatches()[0]?.body).toEqual({ categoryId: target.id });
    await waitFor(async () =>
      expect(within(await rowOf(item.name)).getAllByRole("combobox")[0]).toHaveTextContent(
        item.categoryName,
      ),
    );
  });

  const selectTwo = async (names: string[]) => {
    renderWithQuery(<TransactionsPage />);
    await rowOf(names[0] as string);
    // the initial search debounce (300 ms) resets the selection: wait it out first
    await new Promise((resolve) => setTimeout(resolve, 350));
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
  });

  it("mantém a seleção e as categorias antigas e mostra erro em português quando o lote falha", async () => {
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
    expect(
      await screen.findByText("Registro não encontrado. Atualize a página e tente de novo"),
    ).toBeInTheDocument();
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
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(singlePatches()[0]?.body).toEqual({ neutral: true });
    await waitFor(async () => {
      const current = await rowOf(item.name);
      expect(
        within(current).getByRole("switch", { name: `Marcar ${item.name} como neutra` }),
      ).not.toBeChecked();
      expect(within(current).queryByText("Neutra")).not.toBeInTheDocument();
    });
  });
});

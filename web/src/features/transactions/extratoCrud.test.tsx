import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { mockRequest } from "@/lib/api/mock";
import type { Account, Category, Transaction } from "@/lib/api/types";
import { renderWithQuery, requests, resetSpy } from "@/test/apiSpy";
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
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

const callsTo = (method: string, pattern: RegExp) =>
  requests.filter((request) => request.method === method && pattern.test(request.path));
const rowOf = async (name: string) => {
  const cells = await screen.findAllByText(name);
  return cells.find((cell) => cell.closest("tr"))?.closest("tr") as HTMLElement;
};
const activeAccount = async () =>
  (await mockRequest<Account[]>({ method: "GET", path: "/accounts?active=true" }))[0] as Account;

/** Seeds a transaction dated in 2030 so it leads the default (date desc) first page. */
const seed = async (name: string, extra: Record<string, unknown> = {}) =>
  mockRequest<Transaction>({
    method: "POST",
    path: "/transactions",
    body: {
      name,
      type: "Expense",
      occurredAt: "2030-01-20T12:00:00Z",
      amount: "20.00",
      accountId: (await activeAccount()).id,
      paymentMethod: "PIX",
      ...extra,
    },
  });

describe("extrato: exclusão, criação e edição", () => {
  it("confirmar a exclusão chama DELETE e remove a linha; cancelar mantém a linha sem DELETE", async () => {
    const keep = await seed("Crud manter");
    const drop = await seed("Crud excluir");
    renderWithQuery(<TransactionsPage />);
    await rowOf(keep.name);

    fireEvent.click(within(await rowOf(keep.name)).getByRole("button", { name: /^Excluir / }));
    let dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(callsTo("DELETE", /^\/transactions\//)).toHaveLength(0);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(await rowOf(keep.name)).toBeInTheDocument();

    fireEvent.click(within(await rowOf(drop.name)).getByRole("button", { name: /^Excluir / }));
    dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(screen.queryAllByText(drop.name)).toHaveLength(0));
    expect(callsTo("DELETE", /^\/transactions\//).map((call) => call.path)).toEqual([
      `/transactions/${drop.id}`,
    ]);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledExactlyOnceWith("Transação excluída"),
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(await rowOf(keep.name)).toBeInTheDocument();
  });

  it("cria pelo formulário enviando amount '1234.56' como texto, a conta escolhida e a data convertida", async () => {
    const account = await activeAccount();
    const categories = await mockRequest<Category[]>({ method: "GET", path: "/categories" });
    const uncategorized = categories.find((category) => category.key === "Uncategorized");
    renderWithQuery(<TransactionsPage />);
    await screen.findByText(/Página 1 de/);
    fireEvent.click(screen.getByRole("button", { name: "Nova transação" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Crud criada" } });
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "1.234,56" } });
    fireEvent.change(within(dialog).getByLabelText("Data"), { target: { value: "2031-03-15" } });
    fireEvent.click(within(dialog).getByLabelText("Conta"));
    fireEvent.click(await screen.findByRole("option", { name: account.nickname }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(callsTo("POST", /^\/transactions$/)).toHaveLength(1));
    const body = callsTo("POST", /^\/transactions$/)[0]?.body as Record<string, unknown>;
    expect(body).toMatchObject({
      name: "Crud criada",
      type: "Expense",
      amount: "1234.56",
      accountId: account.id,
      paymentMethod: "PIX",
      occurredAt: new Date("2031-03-15T12:00:00").toISOString(),
      categoryId: uncategorized?.id,
    });
    expect(typeof body["amount"]).toBe("string");
    const row = await rowOf("Crud criada");
    expect(within(row).getByText(/1\.234,56/)).toBeInTheDocument();
    expect(within(row).getByText(account.nickname)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("edita enviando os campos do formulário, com notes e receipt null ao esvaziar, e a lista mostra a mudança", async () => {
    const item = await seed("Crud editar", {
      notes: "Nota antiga",
      receipt: "https://exemplo.com/recibo.pdf",
    });
    renderWithQuery(<TransactionsPage />);
    fireEvent.click(within(await rowOf(item.name)).getByRole("button", { name: /^Editar / }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByLabelText("Nome")).toHaveValue(item.name));
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Crud editada" } });
    fireEvent.change(within(dialog).getByLabelText("Observações"), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    const path = `/transactions/${item.id}`;
    await waitFor(() => expect(callsTo("PATCH", /^\/transactions\/[^/]+$/)).toHaveLength(1));
    const call = callsTo("PATCH", /^\/transactions\/[^/]+$/)[0];
    expect(call?.path).toBe(path);
    expect(call?.body).toMatchObject({
      name: "Crud editada",
      notes: null,
      receipt: "https://exemplo.com/recibo.pdf",
      amount: "20.00",
      accountId: item.accountId,
      categoryId: item.categoryId,
      type: "Expense",
      paymentMethod: "PIX",
      occurredAt: new Date(
        `${new Date(item.occurredAt).toLocaleDateString("sv")}T12:00:00`,
      ).toISOString(),
    });
    const row = await rowOf("Crud editada");
    expect(within(row).queryByText("Nota antiga")).not.toBeInTheDocument();
    expect(screen.queryAllByText("Crud editar")).toHaveLength(0);
  });

  it("não oferece conta inativa no formulário, mas a lista como opção do filtro", async () => {
    const inactive = await mockRequest<Account>({
      method: "POST",
      path: "/accounts",
      body: { bank: "Neon", nickname: "Conta CRUD inativa", holderNames: ["Gabriel"] },
    });
    await mockRequest({ method: "POST", path: `/accounts/${inactive.id}/deactivate` });
    const active = await activeAccount();
    renderWithQuery(<TransactionsPage />);
    await screen.findByText(/Página 1 de/);

    fireEvent.click(screen.getByRole("button", { name: "Nova transação" }));
    const dialog = await screen.findByRole("dialog");
    const trigger = within(dialog).getByLabelText("Conta");
    await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger);
    expect(await screen.findByRole("option", { name: active.nickname })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Conta CRUD inativa/ })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const filter = screen.getByLabelText("Conta");
    await waitFor(() => expect(filter).toBeEnabled());
    fireEvent.click(filter);
    expect(
      await screen.findByRole("option", { name: "Conta CRUD inativa (inativa)" }),
    ).toBeInTheDocument();
  });
});

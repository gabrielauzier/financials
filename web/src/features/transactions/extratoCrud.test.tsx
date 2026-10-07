import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { mockRequest } from "@/lib/api/mock";
import type { Account, Category, Transaction } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import { GENERIC_ERROR } from "@/lib/api/errorMessages";
import { failures, renderWithQuery, requests, resetSpy } from "@/test/apiSpy";
import { pickDate } from "@/test/datePicker";
import { trimTransactions } from "@/test/extratoKit";
import { TransactionsPage } from "./TransactionsPage";

vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("sonner")>()),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

// each test seeds the rows it acts on: the 120 rows of the mock would only make every render slower
beforeAll(() => trimTransactions());

afterEach(() => {
  cleanup();
  resetSpy();
  vi.useRealTimers();
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
    // the calendar opens on today's month: put the clock in March 2031 so the day is one click away
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2031, 2, 10, 12) });
    renderWithQuery(<TransactionsPage />);
    await screen.findByText(/Página 1 de/);
    fireEvent.click(screen.getByRole("button", { name: "Nova transação" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Crud criada" } });
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "1.234,56" } });
    pickDate(within(dialog).getByLabelText("Data"), "2031-03-15");
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
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Transação criada");
    expect(toast.error).not.toHaveBeenCalled();
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
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Transação atualizada");
    expect(toast.error).not.toHaveBeenCalled();
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

  describe("formulário: data, hoje local e toasts", () => {
    const openCreate = async () => {
      fireEvent.click(screen.getByRole("button", { name: "Nova transação" }));
      return screen.findByRole("dialog");
    };
    const fillRequired = async (dialog: HTMLElement, name: string) => {
      fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: name } });
      fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "10,00" } });
      fireEvent.click(within(dialog).getByLabelText("Conta"));
      fireEvent.click(
        await screen.findByRole("option", { name: (await activeAccount()).nickname }),
      );
    };
    const submit = (dialog: HTMLElement) =>
      fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    const originalTZ = process.env["TZ"];
    afterEach(() => {
      if (originalTZ === undefined) delete process.env["TZ"];
      else process.env["TZ"] = originalTZ;
    });

    it("o formulário de criação abre com hoje no fuso local (23:30 em São Paulo) e recalcula ao reabrir", async () => {
      process.env["TZ"] = "America/Sao_Paulo";
      vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 5, 23, 30) });
      renderWithQuery(<TransactionsPage />);
      await screen.findByText(/Página 1 de/);
      let dialog = await openCreate();
      expect(within(dialog).getByLabelText("Data")).toHaveTextContent("05/10/2026");
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      // a tab left open past midnight: the default date follows the clock, not the module load
      vi.setSystemTime(new Date(2026, 9, 6, 8, 0));
      dialog = await openCreate();
      expect(within(dialog).getByLabelText("Data")).toHaveTextContent("06/10/2026");
    });

    it("escolher um dia envia occurredAt ao meio-dia local desse dia", async () => {
      process.env["TZ"] = "America/Sao_Paulo";
      // the calendar opens on today's month: put the clock in December 2026
      vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 11, 10, 12) });
      renderWithQuery(<TransactionsPage />);
      await screen.findByText(/Página 1 de/);
      const dialog = await openCreate();
      await fillRequired(dialog, "Crud data");
      pickDate(within(dialog).getByLabelText("Data"), "2026-12-31");
      submit(dialog);
      await waitFor(() => expect(callsTo("POST", /^\/transactions$/)).toHaveLength(1));
      const body = callsTo("POST", /^\/transactions$/)[0]?.body as { occurredAt: string };
      expect(body.occurredAt).toBe("2026-12-31T15:00:00.000Z");
      expect(new Date(body.occurredAt).getHours()).toBe(12);
    });

    it("enviar sem data mostra 'Informe a data' no campo e não chama a API", async () => {
      renderWithQuery(<TransactionsPage />);
      await screen.findByText(/Página 1 de/);
      const dialog = await openCreate();
      await fillRequired(dialog, "Crud sem data");
      fireEvent.click(within(dialog).getByLabelText("Data"));
      fireEvent.click(await screen.findByRole("button", { name: "Limpar" }));
      expect(within(dialog).getByLabelText("Data")).toHaveTextContent("Selecione a data");
      submit(dialog);
      expect(await within(dialog).findByText("Informe a data")).toHaveAttribute(
        "id",
        "transaction-date-error",
      );
      expect(callsTo("POST", /^\/transactions$/)).toHaveLength(0);
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("editar só o nome fecha o diálogo e emite 'Transação atualizada'", async () => {
      const item = await seed("Crud só nome");
      renderWithQuery(<TransactionsPage />);
      fireEvent.click(within(await rowOf(item.name)).getByRole("button", { name: /^Editar / }));
      const dialog = await screen.findByRole("dialog");
      await waitFor(() => expect(within(dialog).getByLabelText("Nome")).toHaveValue(item.name));
      fireEvent.change(within(dialog).getByLabelText("Nome"), {
        target: { value: "Crud só nome 2" },
      });
      submit(dialog);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(toast.success).toHaveBeenCalledExactlyOnceWith("Transação atualizada");
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("falha na criação com field mantém o diálogo aberto, o erro no campo e emite o toast do mapa", async () => {
      renderWithQuery(<TransactionsPage />);
      await screen.findByText(/Página 1 de/);
      const dialog = await openCreate();
      await fillRequired(dialog, "Crud falha criar");
      failures.set(
        "POST /transactions",
        new ApiError("invalid_amount", "Amount must be positive", 422, "amount"),
      );
      submit(dialog);
      await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith("Valor inválido"));
      expect(await within(dialog).findByText("Valor inválido")).toHaveAttribute(
        "id",
        "transaction-amount-error",
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalledWith("Amount must be positive");
    });

    it("falha de rede na criação mantém o diálogo aberto, mostra o erro do formulário e emite o texto genérico", async () => {
      renderWithQuery(<TransactionsPage />);
      await screen.findByText(/Página 1 de/);
      const dialog = await openCreate();
      await fillRequired(dialog, "Crud falha rede");
      failures.set("POST /transactions", new TypeError("Failed to fetch"));
      submit(dialog);
      await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith(GENERIC_ERROR));
      expect(await within(dialog).findByText(GENERIC_ERROR)).toHaveAttribute("role", "alert");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("falha na edição (PATCH e recarga falham) mantém o diálogo, mantém a lista antiga e emite o toast", async () => {
      const item = await seed("Crud falha editar");
      renderWithQuery(<TransactionsPage />);
      fireEvent.click(within(await rowOf(item.name)).getByRole("button", { name: /^Editar / }));
      const dialog = await screen.findByRole("dialog");
      await waitFor(() => expect(within(dialog).getByLabelText("Nome")).toHaveValue(item.name));
      fireEvent.change(within(dialog).getByLabelText("Nome"), {
        target: { value: "Nome rejeitado" },
      });
      failures.set(
        "PATCH /transactions/:id",
        new ApiError("validation_error", "Bad name", 422, "name"),
      );
      failures.set("GET /transactions", new TypeError("Failed to fetch"));
      submit(dialog);
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledExactlyOnceWith("Dados inválidos. Revise os campos"),
      );
      expect(await within(dialog).findByText("Dados inválidos. Revise os campos")).toHaveAttribute(
        "id",
        "transaction-name-error",
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(toast.success).not.toHaveBeenCalled();
      // the optimistic rename was rolled back even though the refetch failed too
      await waitFor(() => expect(screen.queryAllByText("Nome rejeitado")).toHaveLength(0));
      expect((await screen.findAllByText(item.name)).length).toBeGreaterThan(0);
    });
  });
});

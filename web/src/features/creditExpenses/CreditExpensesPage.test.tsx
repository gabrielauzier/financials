import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { mockRequest } from "@/lib/api/mock";
import type { Account, CreditExpense } from "@/lib/api/types";
import { failures, renderWithQuery, requests, resetSpy } from "@/test/apiSpy";
import { CreditExpensesPage } from "./CreditExpensesPage";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
});

const callsTo = (method: string, pattern: RegExp) =>
  requests.filter((request) => request.method === method && pattern.test(request.path));
const activeAccount = async () =>
  (await mockRequest<Account[]>({ method: "GET", path: "/accounts?active=true" }))[0] as Account;
/** Row of the desktop table (the mobile cards render the same data). */
const rowOf = async (name: string) =>
  (await within(await screen.findByRole("table")).findByText(name)).closest("tr") as HTMLElement;
const seed = async (name: string, extra: Record<string, unknown> = {}) =>
  mockRequest<CreditExpense>({
    method: "POST",
    path: "/credit-expenses",
    body: {
      name,
      totalAmount: "600.00",
      paidAmount: "200.00",
      occurredAt: "2031-01-20T15:00:00Z",
      recurrencyDay: 7,
      status: "Active",
      accountId: (await activeAccount()).id,
      ...extra,
    },
  });

describe("CreditExpensesPage", () => {
  it("shows the fixed notice about the dashboard and the manual-update help text", async () => {
    renderWithQuery(<CreditExpensesPage />);
    expect(
      screen.getByText(
        "Estes valores não entram no dashboard de receitas, despesas nem patrimônio.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Status e valor pago são atualizados manualmente."),
    ).toBeInTheDocument();
    await rowOf("Netflix");
  });

  it("lists the expenses with total, paid and remaining amounts per row", async () => {
    await seed("Página restante");
    renderWithQuery(<CreditExpensesPage />);
    const row = within(await rowOf("Página restante"));
    expect(row.getByText("R$ 600,00")).toBeInTheDocument();
    expect(row.getByText("R$ 200,00")).toBeInTheDocument();
    expect(row.getByText("R$ 400,00")).toBeInTheDocument();
    expect(callsTo("GET", /^\/credit-expenses/).map((call) => call.path)).toEqual([
      "/credit-expenses",
    ]);
  });

  it("filters by status sending ?status= and goes back to the full list with Todos", async () => {
    renderWithQuery(<CreditExpensesPage />);
    await rowOf("Netflix");
    fireEvent.click(screen.getByLabelText("Status"));
    fireEvent.click(await screen.findByRole("option", { name: "A cancelar" }));
    await waitFor(() =>
      expect(callsTo("GET", /status=ToCancel/).map((call) => call.path)).toEqual([
        "/credit-expenses?status=ToCancel",
      ]),
    );
    await rowOf("Academia");
    await waitFor(() =>
      expect(within(screen.getByRole("table")).queryByText("Netflix")).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByLabelText("Status", { selector: "#credit-expense-status-filter" }));
    fireEvent.click(await screen.findByRole("option", { name: "Todos" }));
    await rowOf("Netflix");
    expect(requests.at(-1)?.path).toBe("/credit-expenses");
  });

  it("creates an expense through the dialog and lists it", async () => {
    const account = await activeAccount();
    renderWithQuery(<CreditExpensesPage />);
    await rowOf("Netflix");
    fireEvent.click(screen.getByRole("button", { name: "Nova despesa" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Página criada" } });
    fireEvent.change(within(dialog).getByLabelText("Valor total"), {
      target: { value: "1.234,56" },
    });
    fireEvent.change(within(dialog).getByLabelText("Valor já pago"), {
      target: { value: "34,56" },
    });
    fireEvent.change(within(dialog).getByLabelText("Dia da fatura"), { target: { value: "9" } });
    fireEvent.click(within(dialog).getByLabelText("Conta"));
    fireEvent.click(await screen.findByRole("option", { name: account.nickname }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(callsTo("POST", /^\/credit-expenses$/)).toHaveLength(1));
    expect(callsTo("POST", /^\/credit-expenses$/)[0]?.body).toMatchObject({
      name: "Página criada",
      totalAmount: "1234.56",
      paidAmount: "34.56",
      recurrencyDay: 9,
    });
    const row = within(await rowOf("Página criada"));
    expect(row.getByText("R$ 1.234,56")).toBeInTheDocument();
    expect(row.getByText("R$ 34,56")).toBeInTheDocument();
    expect(await row.findByText("R$ 1.200,00")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("edits an expense through the dialog and shows the saved values", async () => {
    const item = await seed("Página editar");
    renderWithQuery(<CreditExpensesPage />);
    fireEvent.click(
      within(await rowOf(item.name)).getByRole("button", { name: `Editar ${item.name}` }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Nome")).toHaveValue("Página editar");
    fireEvent.change(within(dialog).getByLabelText("Nome"), {
      target: { value: "Página editada" },
    });
    fireEvent.change(within(dialog).getByLabelText("Valor já pago"), {
      target: { value: "250,00" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(callsTo("PATCH", /^\/credit-expenses\//)).toHaveLength(1));
    expect(callsTo("PATCH", /^\/credit-expenses\//)[0]?.path).toBe(`/credit-expenses/${item.id}`);
    const row = within(await rowOf("Página editada"));
    expect(row.getByText("R$ 250,00")).toBeInTheDocument();
    expect(await row.findByText("R$ 350,00")).toBeInTheDocument();
  });

  it("changes the status from the row select with a status-only PATCH", async () => {
    const item = await seed("Página status");
    renderWithQuery(<CreditExpensesPage />);
    const row = within(await rowOf(item.name));
    fireEvent.click(row.getByRole("combobox", { name: `Status de ${item.name}` }));
    fireEvent.click(await screen.findByRole("option", { name: "Cancelada" }));
    await waitFor(() => expect(callsTo("PATCH", /^\/credit-expenses\//)).toHaveLength(1));
    expect(callsTo("PATCH", /^\/credit-expenses\//)[0]).toEqual({
      method: "PATCH",
      path: `/credit-expenses/${item.id}`,
      body: { status: "Canceled" },
    });
    await waitFor(async () =>
      expect(
        within(await rowOf(item.name)).getByRole("combobox", { name: `Status de ${item.name}` }),
      ).toHaveTextContent("Cancelada"),
    );
  });

  it("delete: cancel keeps the row; confirm sends DELETE and removes it", async () => {
    const keep = await seed("Página manter");
    renderWithQuery(<CreditExpensesPage />);
    fireEvent.click(
      within(await rowOf(keep.name)).getByRole("button", { name: `Excluir ${keep.name}` }),
    );
    let dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Excluir esta despesa?")).toBeInTheDocument();
    expect(within(dialog).getByText("Essa ação não pode ser desfeita.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(callsTo("DELETE", /^\/credit-expenses\//)).toHaveLength(0);
    expect(await rowOf(keep.name)).toBeInTheDocument();

    fireEvent.click(
      within(await rowOf(keep.name)).getByRole("button", { name: `Excluir ${keep.name}` }),
    );
    dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(within(screen.getByRole("table")).queryByText(keep.name)).not.toBeInTheDocument(),
    );
    expect(callsTo("DELETE", /^\/credit-expenses\//).map((call) => call.path)).toEqual([
      `/credit-expenses/${keep.id}`,
    ]);
  });

  it("shows an error with retry when the list fails to load", async () => {
    failures.set("GET /credit-expenses", new ApiError("internal_error", "Technical English", 500));
    renderWithQuery(<CreditExpensesPage />);
    expect(
      await screen.findByText("Não foi possível carregar as despesas de cartão."),
    ).toBeInTheDocument();
    failures.clear();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await rowOf("Netflix");
  });

  it("shows the empty state when no expense has the filtered status", async () => {
    const canceled = await mockRequest<CreditExpense[]>({
      method: "GET",
      path: "/credit-expenses?status=Canceled",
    });
    for (const item of canceled)
      await mockRequest({ method: "DELETE", path: `/credit-expenses/${item.id}` });
    renderWithQuery(<CreditExpensesPage />);
    await rowOf("Netflix");
    fireEvent.click(screen.getByLabelText("Status"));
    fireEvent.click(await screen.findByRole("option", { name: "Cancelada" }));
    expect(await screen.findByText("Nenhuma despesa de cartão cadastrada.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

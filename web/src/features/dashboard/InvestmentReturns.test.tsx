import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { mockRequest } from "@/lib/api/mock";
import { setMockDataMode } from "@/lib/api/mock/dashboard";
import type { Account, InvestmentReturn, InvestmentReturns as Returns } from "@/lib/api/types";
import { failures, renderWithQuery, requests, resetSpy, responses } from "@/test/apiSpy";
import { InvestmentReturns } from "./InvestmentReturns";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));
  setMockDataMode("seeded"); // seeds relative to the fixed "today"
});
afterEach(() => {
  cleanup();
  resetSpy();
  vi.useRealTimers();
});

const callsTo = (method: string, pattern: RegExp) =>
  requests.filter((request) => request.method === method && pattern.test(request.path));
const account = async () =>
  (await mockRequest<Account[]>({ method: "GET", path: "/accounts" }))[0] as Account;
const list = () => mockRequest<Returns>({ method: "GET", path: "/investment-returns" });
const seed = async (occurredOn: string, amount = "10.00", notes?: string) =>
  mockRequest<InvestmentReturn>({
    method: "POST",
    path: "/investment-returns",
    body: { occurredOn, amount, accountId: (await account()).id, ...(notes ? { notes } : {}) },
  });
const rowOf = async (text: string) => (await screen.findByText(text)).closest("tr") as HTMLElement;
const dataRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

async function fillAndSave(fields: { amount?: string; date?: string; notes?: string }) {
  const dialog = await screen.findByRole("dialog");
  if (fields.date !== undefined)
    fireEvent.change(within(dialog).getByLabelText("Data"), { target: { value: fields.date } });
  if (fields.amount !== undefined)
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: fields.amount } });
  if (fields.notes !== undefined)
    fireEvent.change(within(dialog).getByLabelText("Observações"), {
      target: { value: fields.notes },
    });
  fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
  return dialog;
}
async function pickAccount(dialog: HTMLElement) {
  await waitFor(() => expect(within(dialog).getByLabelText("Conta")).toBeEnabled());
  fireEvent.click(within(dialog).getByLabelText("Conta"));
  fireEvent.click(await screen.findByRole("option", { name: (await account()).nickname }));
}

describe("InvestmentReturns list", () => {
  it("lists the returns newest first with date, account, signed value and notes", async () => {
    renderWithQuery(<InvestmentReturns />);
    await screen.findByRole("table");
    const rows = dataRows();
    expect(rows).toHaveLength(3);
    // Seeded: 5, 35 and 66 days before 2026-10-15; the second one is a loss.
    expect(within(rows[0] as HTMLElement).getByText("10/10/2026")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("+R$ 42,10")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("Tesouro Selic")).toBeInTheDocument();
    expect(
      within(rows[0] as HTMLElement).getByText((await account()).nickname),
    ).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("10/09/2026")).toBeInTheDocument();
    const loss = within(rows[1] as HTMLElement).getByText("-R$ 18,50");
    expect(loss).toHaveClass("text-red-600");
    expect(within(rows[0] as HTMLElement).getByText("+R$ 42,10")).toHaveClass("text-green-600");
    expect(within(rows[2] as HTMLElement).getByText("10/08/2026")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Aportes e resgates não alteram o patrimônio; lance aqui o ganho ou a perda dos seus investimentos.",
      ),
    ).toBeInTheDocument();
    expect(requests.map((request) => request.path)).toEqual(["/investment-returns"]);
  });

  it("shows the last entry date without a reminder when it is within 30 days", async () => {
    renderWithQuery(<InvestmentReturns />);
    const line = await screen.findByText(/Último lançamento em 10\/10\/2026/);
    expect(line).not.toHaveAttribute("data-stale");
    expect(screen.queryByText("Atualize seus rendimentos")).not.toBeInTheDocument();
  });

  it.each([
    ["2026-09-15", false],
    ["2026-09-14", true],
  ])(
    "last entry on %s highlights the reminder: %s (30 days is not 'more than 30')",
    async (date, stale) => {
      setMockDataMode("empty");
      await seed(date);
      renderWithQuery(<InvestmentReturns />);
      const [year, month, day] = date.split("-");
      const line = await screen.findByText(
        new RegExp(`Último lançamento em ${day}/${month}/${year}`),
      );
      if (stale) {
        expect(line).toHaveAttribute("data-stale", "true");
        expect(line).toHaveClass("bg-amber-50");
        expect(within(line).getByText("Atualize seus rendimentos")).toBeInTheDocument();
      } else {
        expect(line).not.toHaveAttribute("data-stale");
        expect(screen.queryByText("Atualize seus rendimentos")).not.toBeInTheDocument();
      }
    },
  );

  it("shows the empty state, with no last-entry line, when there are no returns", async () => {
    setMockDataMode("empty");
    renderWithQuery(<InvestmentReturns />);
    expect(await screen.findByText("Nenhum rendimento lançado")).toBeInTheDocument();
    expect(screen.queryByText(/Último lançamento/)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a skeleton while loading and an error with retry", async () => {
    responses.set("GET /investment-returns", () => new Promise(() => {}));
    const { unmount } = renderWithQuery(<InvestmentReturns />);
    expect(screen.getByRole("status", { name: /Carregando/ })).toBeInTheDocument();
    unmount();
    responses.clear();
    failures.set(
      "GET /investment-returns",
      new ApiError("internal_error", "Technical English", 500),
    );
    renderWithQuery(<InvestmentReturns />);
    expect(await screen.findByText("Não foi possível carregar este painel.")).toBeInTheDocument();
    failures.clear();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });
});

describe("InvestmentReturns create", () => {
  it("rejects a zero amount and more than 2 decimals with 'Valor inválido' without calling the API", async () => {
    renderWithQuery(<InvestmentReturns />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Novo rendimento" }));
    let dialog = await fillAndSave({ amount: "0,00" });
    await pickAccount(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText("Valor inválido")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "10,123" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText("Valor inválido")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText("Informe o valor")).toBeInTheDocument();
    dialog = screen.getByRole("dialog");
    expect(callsTo("POST", /./)).toHaveLength(0);
  });

  it("requires the account", async () => {
    renderWithQuery(<InvestmentReturns />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Novo rendimento" }));
    await fillAndSave({ amount: "5,00" });
    expect(await screen.findByText("Informe a conta")).toBeInTheDocument();
    expect(callsTo("POST", /./)).toHaveLength(0);
  });

  it("converts a Brazilian negative amount to a decimal string and lists the new row", async () => {
    renderWithQuery(<InvestmentReturns />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Novo rendimento" }));
    const dialog = await screen.findByRole("dialog");
    await pickAccount(dialog);
    await fillAndSave({ amount: "-1.234,56", date: "2026-10-14", notes: "Resgate ruim" });
    await waitFor(() => expect(callsTo("POST", /^\/investment-returns$/)).toHaveLength(1));
    expect(callsTo("POST", /^\/investment-returns$/)[0]?.body).toEqual({
      occurredOn: "2026-10-14",
      amount: "-1234.56",
      accountId: (await account()).id,
      notes: "Resgate ruim",
    });
    const row = within(await rowOf("-R$ 1.234,56"));
    expect(row.getByText("14/10/2026")).toBeInTheDocument();
    expect(row.getByText("Resgate ruim")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows the Portuguese message, never the API text, when the API rejects the create", async () => {
    renderWithQuery(<InvestmentReturns />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Novo rendimento" }));
    const dialog = await screen.findByRole("dialog");
    await pickAccount(dialog);
    failures.set(
      "POST /investment-returns",
      new ApiError("invalid_date", "Technical English text", 422, "occurredOn"),
    );
    await fillAndSave({ amount: "5,00" });
    expect(await within(dialog).findByText("Data inválida")).toBeInTheDocument();
    expect(screen.queryByText(/Technical English/)).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("InvestmentReturns edit", () => {
  const editButton = async (date: string) =>
    within(await rowOf(date)).getByRole("button", { name: `Editar rendimento de ${date}` });

  it("prefills the form, validates the non-zero amount and sends a PATCH with the saved values", async () => {
    const item = await seed("2026-10-12", "-20.00", "Antiga");
    renderWithQuery(<InvestmentReturns />);
    fireEvent.click(await editButton("12/10/2026"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Valor")).toHaveValue("-20,00");
    expect(within(dialog).getByLabelText("Observações")).toHaveValue("Antiga");
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "0" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText("Valor inválido")).toBeInTheDocument();
    expect(callsTo("PATCH", /./)).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "35,5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(callsTo("PATCH", /./)).toHaveLength(1));
    expect(callsTo("PATCH", /./)[0]).toEqual({
      method: "PATCH",
      path: `/investment-returns/${item.id}`,
      body: {
        occurredOn: "2026-10-12",
        amount: "35.50",
        accountId: item.accountId,
        notes: "Antiga",
      },
    });
    expect(await screen.findByText("+R$ 35,50")).toBeInTheDocument();
    expect(screen.queryByText("-R$ 20,00")).not.toBeInTheDocument();
  });

  it("sends notes: null when the notes of an existing return are cleared, and the row shows a dash", async () => {
    const item = await seed("2026-10-12", "-20.00", "Antiga");
    renderWithQuery(<InvestmentReturns />);
    expect(await screen.findByText("Antiga")).toBeInTheDocument();
    fireEvent.click(await editButton("12/10/2026"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Observações"), { target: { value: "  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(callsTo("PATCH", /./)).toHaveLength(1));
    expect(callsTo("PATCH", /./)[0]?.body).toEqual({
      occurredOn: "2026-10-12",
      amount: "-20.00",
      accountId: item.accountId,
      notes: null,
    });
    await waitFor(() => expect(screen.queryByText("Antiga")).not.toBeInTheDocument());
    expect(within(await rowOf("12/10/2026")).getByText("—")).toBeInTheDocument();
  });

  it("restores the previous row and shows the Portuguese message when the PATCH and the refetch fail", async () => {
    await seed("2026-10-12", "-20.00");
    renderWithQuery(<InvestmentReturns />);
    fireEvent.click(await editButton("12/10/2026"));
    const dialog = await screen.findByRole("dialog");
    failures.set(
      "PATCH /investment-returns/:id",
      new ApiError("invalid_amount", "Technical English text", 422, "amount"),
    );
    failures.set("GET /investment-returns", new Error("refetch failed"));
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "99,99" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByText("Valor inválido")).toBeInTheDocument();
    expect(screen.queryByText(/Technical English/)).not.toBeInTheDocument();
    await waitFor(() => expect(callsTo("GET", /^\/investment-returns$/)).toHaveLength(2));
    expect(screen.getByText("-R$ 20,00")).toBeInTheDocument();
    expect(screen.queryByText("+R$ 99,99")).not.toBeInTheDocument();
  });
});

describe("InvestmentReturns delete", () => {
  const deleteButton = async (date: string) =>
    within(await rowOf(date)).getByRole("button", { name: `Excluir rendimento de ${date}` });

  it("cancel keeps the row; confirm sends DELETE and removes it", async () => {
    const item = await seed("2026-10-13", "7.77");
    renderWithQuery(<InvestmentReturns />);
    fireEvent.click(await deleteButton("13/10/2026"));
    let dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Excluir este rendimento?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(callsTo("DELETE", /./)).toHaveLength(0);
    expect(screen.getByText("+R$ 7,77")).toBeInTheDocument();

    fireEvent.click(await deleteButton("13/10/2026"));
    dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(screen.queryByText("+R$ 7,77")).not.toBeInTheDocument());
    expect(callsTo("DELETE", /./).map((call) => call.path)).toEqual([
      `/investment-returns/${item.id}`,
    ]);
    expect((await list()).items.some((row) => row.id === item.id)).toBe(false);
  });

  it("a failed delete shows the Portuguese message, never the API text, and keeps the row", async () => {
    await seed("2026-10-13", "7.77");
    renderWithQuery(<InvestmentReturns />);
    fireEvent.click(await deleteButton("13/10/2026"));
    const dialog = await screen.findByRole("alertdialog");
    failures.set(
      "DELETE /investment-returns/:id",
      new ApiError("not_found", "Investment return not found", 404),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    expect(
      await screen.findByText("Registro não encontrado. Atualize a página e tente de novo"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Investment return not found")).not.toBeInTheDocument();
    expect(screen.getByText("+R$ 7,77")).toBeInTheDocument();
  });
});

describe("InvestmentReturns account selector", () => {
  const inactiveAccount = async (nickname: string) => {
    const created = await mockRequest<Account>({
      method: "POST",
      path: "/accounts",
      body: { bank: "Nubank", nickname, holderNames: ["Titular Teste"] },
    });
    await mockRequest({ method: "POST", path: `/accounts/${created.id}/deactivate` });
    return created;
  };

  it("offers an inactive account, marked (inativa), when creating a return", async () => {
    await inactiveAccount("Conta inativa criar");
    renderWithQuery(<InvestmentReturns />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Novo rendimento" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByLabelText("Conta")).toBeEnabled());
    fireEvent.click(within(dialog).getByLabelText("Conta"));
    expect(
      await screen.findByRole("option", { name: "Conta inativa criar (inativa)" }),
    ).toBeInTheDocument();
  });

  it("shows the inactive account of an existing return, marked (inativa), when editing", async () => {
    const inactive = await inactiveAccount("Conta inativa editar");
    await mockRequest<InvestmentReturn>({
      method: "POST",
      path: "/investment-returns",
      body: { occurredOn: "2026-10-12", amount: "5.00", accountId: inactive.id },
    });
    renderWithQuery(<InvestmentReturns />);
    fireEvent.click(
      within(await rowOf("12/10/2026")).getByRole("button", {
        name: "Editar rendimento de 12/10/2026",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).getByLabelText("Conta")).toHaveTextContent(
        "Conta inativa editar (inativa)",
      ),
    );
    fireEvent.click(within(dialog).getByLabelText("Conta"));
    expect(
      await screen.findByRole("option", { name: "Conta inativa editar (inativa)" }),
    ).toBeInTheDocument();
  });
});

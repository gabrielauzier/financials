import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { mockRequest } from "@/lib/api/mock";
import type { Account, CreditExpense } from "@/lib/api/types";
import { failures, renderWithQuery, requests, resetSpy } from "@/test/apiSpy";
import { CreditExpenseForm } from "./CreditExpenseForm";

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

async function openForm(expense?: CreditExpense) {
  const onOpenChange = vi.fn();
  renderWithQuery(
    <CreditExpenseForm open onOpenChange={onOpenChange} {...(expense ? { expense } : {})} />,
  );
  const dialog = await screen.findByRole("dialog");
  return { dialog, onOpenChange };
}
const fill = (dialog: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
const save = (dialog: HTMLElement) =>
  fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
async function chooseAccount(dialog: HTMLElement, account: Account) {
  fireEvent.click(within(dialog).getByLabelText("Conta"));
  fireEvent.click(await screen.findByRole("option", { name: account.nickname }));
}
/** Fills every required field with valid data; individual tests then override one. */
async function fillValid(dialog: HTMLElement) {
  fill(dialog, "Nome", "Notebook");
  fill(dialog, "Valor total", "600,00");
  fill(dialog, "Data", "2031-03-15");
  fill(dialog, "Dia da fatura", "7");
  await chooseAccount(dialog, await activeAccount());
}
const errorOf = (dialog: HTMLElement, id: string) =>
  dialog.querySelector(`#credit-expense-${id}-error`)?.textContent;

describe("CreditExpenseForm validation", () => {
  it("asks for every required field when empty", async () => {
    const { dialog } = await openForm();
    fill(dialog, "Data", "");
    save(dialog);
    expect(errorOf(dialog, "name")).toBe("Informe o nome");
    expect(errorOf(dialog, "total")).toBe("Informe o valor total");
    expect(errorOf(dialog, "date")).toBe("Informe a data");
    expect(errorOf(dialog, "day")).toBe("Informe o dia da fatura");
    expect(errorOf(dialog, "account")).toBe("Informe a conta");
    expect(callsTo("POST", /^\/credit-expenses$/)).toHaveLength(0);
  });

  it.each(["0", "0,00", "10,123", "abc", "-5"])(
    "rejects the total %s with 'Valor total inválido' and sends nothing",
    async (value) => {
      const { dialog } = await openForm();
      await fillValid(dialog);
      fill(dialog, "Valor total", value);
      save(dialog);
      expect(errorOf(dialog, "total")).toBe("Valor total inválido");
      expect(callsTo("POST", /^\/credit-expenses$/)).toHaveLength(0);
    },
  );

  it.each(["-5", "1,234", "abc", "600,01"])(
    "rejects the paid amount %s (negative, 3 decimals, text or above the total) with 'Valor pago inválido'",
    async (value) => {
      const { dialog } = await openForm();
      await fillValid(dialog);
      fill(dialog, "Valor já pago", value);
      save(dialog);
      expect(errorOf(dialog, "paid")).toBe("Valor pago inválido");
      expect(callsTo("POST", /^\/credit-expenses$/)).toHaveLength(0);
    },
  );

  it.each(["0", "32", "1,5", "x"])(
    "rejects the invoice day %s with 'Dia inválido (use de 1 a 31)'",
    async (value) => {
      const { dialog } = await openForm();
      await fillValid(dialog);
      fill(dialog, "Dia da fatura", value);
      save(dialog);
      expect(errorOf(dialog, "day")).toBe("Dia inválido (use de 1 a 31)");
      expect(callsTo("POST", /^\/credit-expenses$/)).toHaveLength(0);
    },
  );
});

describe("CreditExpenseForm submit", () => {
  it("creates sending '1234.56' as text, the day as a number, the paid amount as text and an offset date", async () => {
    const account = await activeAccount();
    const { dialog, onOpenChange } = await openForm();
    fill(dialog, "Nome", "  Notebook  ");
    fill(dialog, "Valor total", "1.234,56");
    fill(dialog, "Valor já pago", "200,5");
    fill(dialog, "Data", "2031-03-15");
    fill(dialog, "Dia da fatura", "7");
    fill(dialog, "Observações", "  12 parcelas  ");
    await chooseAccount(dialog, account);
    save(dialog);
    await waitFor(() => expect(callsTo("POST", /^\/credit-expenses$/)).toHaveLength(1));
    const body = callsTo("POST", /^\/credit-expenses$/)[0]?.body as Record<string, unknown>;
    expect(body).toEqual({
      name: "Notebook",
      totalAmount: "1234.56",
      paidAmount: "200.50",
      occurredAt: new Date("2031-03-15T12:00:00").toISOString(),
      recurrencyDay: 7,
      status: "Active",
      accountId: account.id,
      notes: "12 parcelas",
    });
    expect(typeof body["totalAmount"]).toBe("string");
    expect(typeof body["recurrencyDay"]).toBe("number");
    expect(body).not.toHaveProperty("categoryId");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("omits the paid amount when empty and accepts a whole total, status choice and a chosen category", async () => {
    const { dialog } = await openForm();
    await fillValid(dialog);
    fill(dialog, "Valor total", "600");
    fireEvent.click(within(dialog).getByLabelText("Status"));
    fireEvent.click(await screen.findByRole("option", { name: "A cancelar" }));
    fireEvent.click(within(dialog).getByLabelText("Categoria"));
    fireEvent.click(await screen.findByRole("option", { name: "Alimentação" }));
    save(dialog);
    await waitFor(() => expect(callsTo("POST", /^\/credit-expenses$/)).toHaveLength(1));
    const body = callsTo("POST", /^\/credit-expenses$/)[0]?.body as Record<string, unknown>;
    expect(body).toMatchObject({ totalAmount: "600.00", status: "ToCancel" });
    expect(body).not.toHaveProperty("paidAmount");
    expect(body["categoryId"]).toEqual(expect.any(String));
    expect(body).not.toHaveProperty("notes");
  });

  it("accepts a paid amount of zero", async () => {
    const { dialog } = await openForm();
    await fillValid(dialog);
    fill(dialog, "Valor já pago", "0,00");
    save(dialog);
    await waitFor(() => expect(callsTo("POST", /^\/credit-expenses$/)).toHaveLength(1));
    expect(callsTo("POST", /^\/credit-expenses$/)[0]?.body).toMatchObject({ paidAmount: "0.00" });
  });

  it("accepts a paid amount equal to the total", async () => {
    const { dialog } = await openForm();
    await fillValid(dialog);
    fill(dialog, "Valor já pago", "600,00");
    save(dialog);
    await waitFor(() => expect(callsTo("POST", /^\/credit-expenses$/)).toHaveLength(1));
    expect(callsTo("POST", /^\/credit-expenses$/)[0]?.body).toMatchObject({
      paidAmount: "600.00",
    });
  });

  it.each([
    ["invalid_amount", "totalAmount", "total", "Valor total inválido"],
    ["invalid_paid_amount", "paidAmount", "paid", "Valor pago inválido"],
    ["invalid_day", "recurrencyDay", "day", "Dia inválido (use de 1 a 31)"],
    ["invalid_status", "status", "status", "Status inválido"],
    ["invalid_account", "accountId", "account", "Selecione uma conta ativa"],
  ])(
    "shows the Portuguese message of %s on its field and never the API text",
    async (code, field, id, message) => {
      failures.set(
        "POST /credit-expenses",
        new ApiError(code, "Technical English text", 422, field),
      );
      const { dialog, onOpenChange } = await openForm();
      await fillValid(dialog);
      save(dialog);
      await waitFor(() => expect(errorOf(dialog, id)).toBe(message));
      expect(dialog).not.toHaveTextContent("Technical English text");
      expect(onOpenChange).not.toHaveBeenCalled();
    },
  );

  it("shows a form-level Portuguese message for errors without a known field", async () => {
    failures.set("POST /credit-expenses", new ApiError("something_new", "Technical English", 500));
    const { dialog } = await openForm();
    await fillValid(dialog);
    save(dialog);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir a operação. Tente novamente.",
    );
  });
});

describe("CreditExpenseForm edit", () => {
  const seed = async (notes: string | null) =>
    mockRequest<CreditExpense>({
      method: "POST",
      path: "/credit-expenses",
      body: {
        name: "Editável",
        totalAmount: "1234.56",
        paidAmount: "34.50",
        occurredAt: "2031-04-10T15:00:00Z",
        recurrencyDay: 12,
        status: "Inactive",
        accountId: (await activeAccount()).id,
        ...(notes ? { notes } : {}),
      },
    });

  it("prefills the fields from the expense", async () => {
    const expense = await seed("Observação antiga");
    const { dialog } = await openForm(expense);
    expect(within(dialog).getByLabelText("Nome")).toHaveValue("Editável");
    expect(within(dialog).getByLabelText("Valor total")).toHaveValue("1234,56");
    expect(within(dialog).getByLabelText("Valor já pago")).toHaveValue("34,50");
    expect(within(dialog).getByLabelText("Data")).toHaveValue("2031-04-10");
    expect(within(dialog).getByLabelText("Dia da fatura")).toHaveValue("12");
    expect(within(dialog).getByLabelText("Observações")).toHaveValue("Observação antiga");
    expect(within(dialog).getByLabelText("Status")).toHaveTextContent("Inativa");
  });

  it("sends notes as null when cleared, via PATCH on the expense id", async () => {
    const expense = await seed("Observação antiga");
    const { dialog, onOpenChange } = await openForm(expense);
    fill(dialog, "Observações", "   ");
    save(dialog);
    await waitFor(() => expect(callsTo("PATCH", /^\/credit-expenses\//)).toHaveLength(1));
    const call = callsTo("PATCH", /^\/credit-expenses\//)[0];
    expect(call?.path).toBe(`/credit-expenses/${expense.id}`);
    expect(call?.body).toMatchObject({
      name: "Editável",
      totalAmount: "1234.56",
      paidAmount: "34.50",
      recurrencyDay: 12,
      status: "Inactive",
      notes: null,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("sends trimmed notes when filled and paid as 0.00 when the field is cleared", async () => {
    const expense = await seed(null);
    const { dialog } = await openForm(expense);
    fill(dialog, "Observações", "  Nova nota  ");
    fill(dialog, "Valor já pago", "");
    save(dialog);
    await waitFor(() => expect(callsTo("PATCH", /^\/credit-expenses\//)).toHaveLength(1));
    expect(callsTo("PATCH", /^\/credit-expenses\//)[0]?.body).toMatchObject({
      notes: "Nova nota",
      paidAmount: "0.00",
    });
  });

  it("rejects lowering the total below the paid amount on the paid field without calling the API", async () => {
    const expense = await seed(null);
    const { dialog } = await openForm(expense);
    fill(dialog, "Valor total", "10,00");
    save(dialog);
    expect(errorOf(dialog, "paid")).toBe("Valor pago inválido");
    expect(callsTo("PATCH", /^\/credit-expenses\//)).toHaveLength(0);
  });
});

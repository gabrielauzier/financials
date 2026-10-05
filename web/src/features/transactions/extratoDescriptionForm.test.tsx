import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockRequest } from "@/lib/api/mock";
import type { Account, Transaction } from "@/lib/api/types";
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
});

const DEFAULT_SUBTITLE = "Preencha os dados do lançamento.";
const ORIGINAL = "PIX ENVIADO MARIA DA SILVA";

const activeAccount = async () =>
  (await mockRequest<Account[]>({ method: "GET", path: "/accounts?active=true" }))[0] as Account;
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
const rowOf = async (name: string) => {
  const cells = await screen.findAllByText(name);
  return cells.find((cell) => cell.closest("tr"))?.closest("tr") as HTMLElement;
};
const openEdit = async (name: string) => {
  renderWithQuery(<TransactionsPage />);
  fireEvent.click(within(await rowOf(name)).getByRole("button", { name: /^Editar / }));
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(within(dialog).getByLabelText("Nome")).toHaveValue(name));
  return dialog;
};
const sentBodies = (method: string, pattern: RegExp) =>
  requests
    .filter((request) => request.method === method && pattern.test(request.path))
    .map((request) => request.body as Record<string, unknown>);

describe("formulário: description somente leitura", () => {
  it("mostra a description como texto abaixo do título na edição, sem campo para ela", async () => {
    await seed("Desc modal com", { description: ORIGINAL });
    const dialog = await openEdit("Desc modal com");
    const subtitle = within(dialog).getByTestId("transaction-description");
    expect(subtitle).toHaveTextContent(ORIGINAL);
    expect(within(dialog).queryByText(DEFAULT_SUBTITLE)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/descri/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByDisplayValue(ORIGINAL)).not.toBeInTheDocument();
    const title = within(dialog).getByRole("heading", { name: "Editar transação" });
    expect(title.compareDocumentPosition(subtitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("mantém o subtítulo padrão e nenhum elemento de description na edição sem description e na criação", async () => {
    await seed("Desc modal sem");
    const dialog = await openEdit("Desc modal sem");
    expect(within(dialog).getByText(DEFAULT_SUBTITLE)).toBeInTheDocument();
    expect(within(dialog).queryByTestId("transaction-description")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Nova transação" }));
    const create = await screen.findByRole("dialog");
    expect(within(create).getByText(DEFAULT_SUBTITLE)).toBeInTheDocument();
    expect(within(create).queryByTestId("transaction-description")).not.toBeInTheDocument();
    expect(within(create).queryByLabelText(/descri/i)).not.toBeInTheDocument();
  });

  it("nunca envia description no PATCH da edição nem no POST da criação", async () => {
    const item = await seed("Desc modal envio", { description: ORIGINAL });
    const dialog = await openEdit(item.name);
    fireEvent.change(within(dialog).getByLabelText("Nome"), {
      target: { value: "Desc modal enviada" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(sentBodies("PATCH", /^\/transactions\/[^/]+$/)).toHaveLength(1));
    expect(sentBodies("PATCH", /^\/transactions\/[^/]+$/)[0]).not.toHaveProperty("description");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Nova transação" }));
    const create = await screen.findByRole("dialog");
    fireEvent.change(within(create).getByLabelText("Nome"), {
      target: { value: "Desc modal nova" },
    });
    fireEvent.change(within(create).getByLabelText("Valor"), { target: { value: "10,00" } });
    fireEvent.click(within(create).getByLabelText("Conta"));
    fireEvent.click(await screen.findByRole("option", { name: (await activeAccount()).nickname }));
    fireEvent.click(within(create).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(sentBodies("POST", /^\/transactions$/)).toHaveLength(1));
    expect(sentBodies("POST", /^\/transactions$/)[0]).not.toHaveProperty("description");
  });
});

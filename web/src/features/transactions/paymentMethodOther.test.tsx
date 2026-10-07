import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mockRequest } from "@/lib/api/mock";
import type { Account, Transaction, TransactionsPage as Page } from "@/lib/api/types";
import { renderWithQuery, requests, resetSpy, responses } from "@/test/apiSpy";
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

// the create-form tests need the page, not its 120 rows
beforeAll(() => trimTransactions());

afterEach(() => {
  cleanup();
  resetSpy();
});

const activeAccount = async () =>
  (await mockRequest<Account[]>({ method: "GET", path: "/accounts?active=true" }))[0] as Account;

describe("método de pagamento Outro", () => {
  it("mostra 'Outro' na tabela do extrato e no cartão mobile para uma transação Other", async () => {
    const base = await mockRequest<Page>({ method: "GET", path: "/transactions" });
    const [first] = base.items as [Transaction];
    const other: Transaction = { ...first, name: "Lançamento Outro", paymentMethod: "Other" };
    responses.set("GET /transactions", { ...base, items: [other], total: 1 });
    renderWithQuery(<TransactionsPage />);
    await screen.findByText("Lançamento Outro", { selector: "div" });

    const row = screen.getByRole("row", { name: /Lançamento Outro/ });
    expect(within(row).getByText("Outro")).toBeInTheDocument();
    const card = screen.getByRole("heading", { name: "Lançamento Outro" }).closest("article");
    expect(within(card as HTMLElement).getByText("Outro")).toBeInTheDocument();
  });

  it("lista as 8 opções em português em 'Método de pagamento', com 'Outro' por último", async () => {
    renderWithQuery(<TransactionsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Nova transação" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText("Método de pagamento"));
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Transferência bancária",
      "Boleto",
      "Dinheiro",
      "Cartão de crédito",
      "Cartão de débito",
      "NuPay",
      "PIX",
      "Outro",
    ]);
  });

  it("envia paymentMethod 'Other' ao criar uma transação escolhendo 'Outro'", async () => {
    renderWithQuery(<TransactionsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Nova transação" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Gasto avulso" } });
    fireEvent.change(within(dialog).getByLabelText("Valor"), { target: { value: "10,00" } });
    fireEvent.click(within(dialog).getByLabelText("Conta"));
    fireEvent.click(await screen.findByRole("option", { name: (await activeAccount()).nickname }));
    fireEvent.click(within(dialog).getByLabelText("Método de pagamento"));
    fireEvent.click(await screen.findByRole("option", { name: "Outro" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(
        requests.filter((r) => r.method === "POST" && r.path === "/transactions"),
      ).toHaveLength(1),
    );
    const sent = requests.find((r) => r.method === "POST" && r.path === "/transactions");
    expect(sent?.body).toMatchObject({ name: "Gasto avulso", paymentMethod: "Other" });
  });
});

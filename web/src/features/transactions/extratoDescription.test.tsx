import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Transaction, TransactionsPage as Page } from "@/lib/api/types";
import { mockRequest } from "@/lib/api/mock";
import { renderWithQuery, resetSpy, responses } from "@/test/apiSpy";
import { TransactionsPage } from "./TransactionsPage";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
});

const LONG = "PIX ENVIADO PARA MARIA DA SILVA REF 20261005 PAGAMENTO DE SERVICOS PRESTADOS";

async function renderWithTwoRows() {
  const base = await mockRequest<Page>({ method: "GET", path: "/transactions" });
  const [first, second] = base.items as [Transaction, Transaction];
  const withText: Transaction = { ...first, name: "Mercado Central", description: LONG };
  const without: Transaction = { ...second, name: "Padaria Sol", description: null };
  responses.set("GET /transactions", { ...base, items: [withText, without], total: 2 });
  renderWithQuery(<TransactionsPage />);
  await screen.findByText("Mercado Central", { selector: "div" });
}

describe("extrato: description below the name", () => {
  it("shows it under the name in the same table cell, small and muted, with the full text in title", async () => {
    await renderWithTwoRows();
    const row = screen.getByRole("row", { name: /Mercado Central/ });
    const text = within(row).getByText(LONG);
    expect(text).toHaveAttribute("title", LONG);
    expect(text).toHaveClass("text-xs", "text-muted-foreground", "truncate");
    const nameCell = within(row).getByText("Mercado Central").closest("td");
    expect(nameCell).toContainElement(text);
    const name = within(row).getByText("Mercado Central");
    expect(name.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows it under the name in the mobile card with the same styling and title", async () => {
    await renderWithTwoRows();
    const card = screen.getByRole("heading", { name: "Mercado Central" }).closest("article");
    expect(card).not.toBeNull();
    const text = within(card as HTMLElement).getByText(LONG);
    expect(text).toHaveAttribute("title", LONG);
    expect(text).toHaveClass("text-xs", "text-muted-foreground", "truncate");
  });

  it("renders no description element for a row or card without description", async () => {
    await renderWithTwoRows();
    const row = screen.getByRole("row", { name: /Padaria Sol/ });
    expect(within(row).queryByTestId("transaction-description")).toBeNull();
    const nameCell = within(row).getByText("Padaria Sol").closest("td");
    expect(nameCell?.children).toHaveLength(1);
    const card = screen.getByRole("heading", { name: "Padaria Sol" }).closest("article");
    expect(within(card as HTMLElement).queryByTestId("transaction-description")).toBeNull();
    expect(screen.getAllByTestId("transaction-description")).toHaveLength(2);
  });
});

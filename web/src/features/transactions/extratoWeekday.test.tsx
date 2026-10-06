import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockRequest } from "@/lib/api/mock";
import type { Transaction, TransactionsPage as Page } from "@/lib/api/types";
import { renderWithQuery, resetSpy, responses } from "@/test/apiSpy";
import { TransactionsPage } from "./TransactionsPage";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

const originalTZ = process.env["TZ"];
beforeEach(() => {
  process.env["TZ"] = "America/Sao_Paulo";
});
afterEach(() => {
  cleanup();
  resetSpy();
  if (originalTZ === undefined) delete process.env["TZ"];
  else process.env["TZ"] = originalTZ;
});

// 23:30 on 5 October 2026 in Sao Paulo (UTC-3) is already the 6th in UTC
const LATE_EVENING = "2026-10-06T02:30:00.000Z";
const YEAR_END = new Date(2026, 11, 31, 12).toISOString();

/** The list answers with three fixed rows (the third has an invalid instant); the tests read their date cells. */
async function serveRows() {
  const [base] = (await mockRequest<Page>({ method: "GET", path: "/transactions" })).items;
  const row = (name: string, occurredAt: string, index: number): Transaction => ({
    ...(base as Transaction),
    id: `50000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    name,
    occurredAt,
    description: null,
  });
  responses.set("GET /transactions", {
    items: [
      row("Dia A", LATE_EVENING, 1),
      row("Dia B", YEAR_END, 2),
      row("Dia C", "instante inválido", 3),
    ],
    total: 3,
    page: 1,
    pageSize: 50,
  });
  return base as Transaction;
}
const rowOf = async (name: string) =>
  (await screen.findAllByText(name))
    .find((cell) => cell.closest("tr"))
    ?.closest("tr") as HTMLElement;
const cardOf = async (name: string) =>
  (await screen.findAllByRole("heading", { name }))
    .find((heading) => heading.closest("article"))
    ?.closest("article") as HTMLElement;

describe("extrato: dia da semana abaixo da data (TUXV2-13)", () => {
  it("a tabela mostra a data e, em uma segunda linha abaixo dela, o dia da semana do dia local às 23:30", async () => {
    await serveRows();
    renderWithQuery(<TransactionsPage />);
    const row = await rowOf("Dia A");
    const date = within(row).getByTestId("transaction-date");
    const weekday = within(row).getByTestId("transaction-weekday");
    expect(date).toHaveTextContent("05/10/2026");
    expect(weekday).toHaveTextContent("Seg");
    expect(date.nextElementSibling).toBe(weekday);
    expect(within(row).getAllByRole("cell")[1]).toContainElement(weekday);
  });

  it("o cartão móvel mostra o dia da semana abaixo da data e mantém a conta depois do '·'", async () => {
    const base = await serveRows();
    renderWithQuery(<TransactionsPage />);
    const card = await cardOf("Dia A");
    const date = within(card).getByTestId("transaction-date");
    const weekday = within(card).getByTestId("transaction-weekday");
    expect(date).toHaveTextContent("05/10/2026");
    expect(weekday).toHaveTextContent("Seg");
    expect(date.nextElementSibling).toBe(weekday);
    expect(card).toHaveTextContent(`· ${base.accountNickname}`);
  });

  it("a virada do ano: 31/12/2026 mostra Qui na tabela e no cartão", async () => {
    await serveRows();
    renderWithQuery(<TransactionsPage />);
    for (const scope of [await rowOf("Dia B"), await cardOf("Dia B")]) {
      expect(within(scope).getByTestId("transaction-date")).toHaveTextContent("31/12/2026");
      expect(within(scope).getByTestId("transaction-weekday")).toHaveTextContent("Qui");
    }
  });

  it("o dia da semana é menor (text-xs) e mais claro (text-muted-foreground) que a data, que não tem essas classes", async () => {
    await serveRows();
    renderWithQuery(<TransactionsPage />);
    for (const scope of [await rowOf("Dia A"), await cardOf("Dia A")]) {
      const weekday = within(scope).getByTestId("transaction-weekday");
      const date = within(scope).getByTestId("transaction-date");
      expect(weekday).toHaveClass("text-xs", "text-muted-foreground");
      expect(date).not.toHaveClass("text-xs");
      expect(date).not.toHaveClass("text-muted-foreground");
    }
  });

  it("um occurredAt inválido não renderiza o dia da semana, nem na tabela nem no cartão", async () => {
    await serveRows();
    renderWithQuery(<TransactionsPage />);
    for (const scope of [await rowOf("Dia C"), await cardOf("Dia C")]) {
      expect(within(scope).queryByTestId("transaction-weekday")).not.toBeInTheDocument();
    }
  });
});

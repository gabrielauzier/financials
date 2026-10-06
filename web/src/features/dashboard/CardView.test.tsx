import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { failures, renderWithQuery, requests, resetSpy, responses } from "@/test/apiSpy";
import { CardView } from "./CardView";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));
});
afterEach(() => {
  cleanup();
  resetSpy();
  vi.useRealTimers();
});

const KEY = "GET /dashboard/card";
const PURCHASES = "Compras no cartão por categoria";
const PAYABLE = "Parcelas e recorrências a pagar";
const NOTICE = "Valores do cartão não somam nos totais de receitas, despesas e patrimônio.";
const section = (name: string) => within(screen.getByRole("region", { name }));
const paths = () => requests.map((request) => request.path);

describe("CardView", () => {
  it("renders both sections separately with their totals and the not-in-totals notice", async () => {
    responses.set(KEY, {
      transactions: [
        { categoryName: "Alimentação", total: "430.20" },
        { categoryName: "Compras", total: "699.90" },
      ],
      creditExpenses: [{ categoryName: "Compras", remaining: "4000.00" }],
    });
    renderWithQuery(<CardView />);
    expect(await screen.findByText(NOTICE)).toBeInTheDocument();
    await screen.findByRole("region", { name: PURCHASES });
    expect(section(PURCHASES).getByText("Alimentação")).toBeInTheDocument();
    expect(section(PURCHASES).getByText("R$ 430,20")).toBeInTheDocument();
    expect(section(PURCHASES).getByText("R$ 699,90")).toBeInTheDocument();
    expect(section(PAYABLE).getByText("Compras")).toBeInTheDocument();
    expect(section(PAYABLE).getByText("R$ 4.000,00")).toBeInTheDocument();
    expect(section(PAYABLE).queryByText("R$ 430,20")).not.toBeInTheDocument();
    expect(paths()).toEqual(["/dashboard/card?from=2026-10-01&to=2026-10-31"]);
  });

  it("requests the new range when the period changes", async () => {
    renderWithQuery(<CardView />);
    await screen.findByRole("region", { name: PURCHASES });
    fireEvent.click(screen.getByLabelText("Período"));
    fireEvent.click(await screen.findByRole("option", { name: "Mês anterior" }));
    await waitFor(() =>
      expect(paths().at(-1)).toBe("/dashboard/card?from=2026-09-01&to=2026-09-30"),
    );
  });

  it("shows an empty state per section when the period has no data", async () => {
    responses.set(KEY, { transactions: [], creditExpenses: [] });
    renderWithQuery(<CardView />);
    expect(await screen.findByText("Sem compras no cartão no período")).toBeInTheDocument();
    expect(screen.getByText("Sem parcelas ou recorrências a pagar")).toBeInTheDocument();
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps the credit-expense section when only the purchases are empty", async () => {
    responses.set(KEY, {
      transactions: [],
      creditExpenses: [{ categoryName: "Compras", remaining: "10.00" }],
    });
    renderWithQuery(<CardView />);
    expect(await screen.findByText("Sem compras no cartão no período")).toBeInTheDocument();
    expect(section(PAYABLE).getByText("R$ 10,00")).toBeInTheDocument();
    expect(screen.queryByText("Sem parcelas ou recorrências a pagar")).not.toBeInTheDocument();
  });

  it("shows a skeleton while loading and an error with retry", async () => {
    responses.set(KEY, () => new Promise(() => {}));
    const { unmount } = renderWithQuery(<CardView />);
    expect(screen.getByRole("status", { name: /Carregando/ })).toBeInTheDocument();
    unmount();
    responses.clear();
    failures.set(KEY, new ApiError("internal_error", "Technical English", 500));
    renderWithQuery(<CardView />);
    expect(await screen.findByText("Não foi possível carregar este painel.")).toBeInTheDocument();
    failures.clear();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("region", { name: PURCHASES })).toBeInTheDocument();
  });
});

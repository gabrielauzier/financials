import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { failures, renderWithQuery, requests, resetSpy, responses } from "@/test/apiSpy";
import { pickDate } from "@/test/datePicker";
import { CategoryBreakdown } from "./CategoryBreakdown";

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

const KEY = "GET /dashboard/categories";
const item = (id: number, name: string, total: string) => ({
  categoryId: `00000000-0000-4000-8000-00000000000${id}`,
  name,
  total,
});
const distribution = {
  items: [
    item(1, "Moradia", "600.00"),
    item(2, "Alimentação", "300.00"),
    item(3, "Transporte", "100.00"),
    item(4, "Estorno (de compras)", "-50.00"),
  ],
};
const paths = () => requests.map((request) => request.path);
const row = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;
const choose = async (option: string) => {
  fireEvent.click(screen.getByLabelText("Período"));
  fireEvent.click(await screen.findByRole("option", { name: option }));
};

describe("CategoryBreakdown", () => {
  it("opens on the current month and lists each category with its value and share", async () => {
    responses.set(KEY, distribution);
    renderWithQuery(<CategoryBreakdown />);
    expect(await screen.findByText("Moradia")).toBeInTheDocument();
    expect(paths()).toEqual(["/dashboard/categories?from=2026-10-01&to=2026-10-31"]);
    expect(within(row("Moradia")).getByText("R$ 600,00")).toBeInTheDocument();
    expect(within(row("Moradia")).getByText("60,0%")).toBeInTheDocument();
    expect(within(row("Alimentação")).getByText("30,0%")).toBeInTheDocument();
    expect(within(row("Transporte")).getByText("10,0%")).toBeInTheDocument();
  });

  it("requests the new range when the period changes", async () => {
    renderWithQuery(<CategoryBreakdown />);
    await screen.findByText("Moradia");
    await choose("Mês anterior");
    await waitFor(() =>
      expect(paths()).toContain("/dashboard/categories?from=2026-09-01&to=2026-09-30"),
    );
    await choose("Últimos 90 dias");
    await waitFor(() =>
      expect(paths()).toContain("/dashboard/categories?from=2026-07-18&to=2026-10-15"),
    );
    await choose("Mês atual");
    await waitFor(() => expect(paths().at(-1)).toBe(paths()[0]));
    expect(paths()).toHaveLength(4);
  });

  it("queries a custom range from the de/até dates and does not query while from is after to", async () => {
    renderWithQuery(<CategoryBreakdown />);
    await screen.findByText("Moradia");
    await choose("Personalizado");
    expect(paths()).toHaveLength(1);
    pickDate("De", "2026-10-05");
    expect(paths()).toHaveLength(1);
    pickDate("Até", "2026-10-20");
    await waitFor(() =>
      expect(paths().at(-1)).toBe("/dashboard/categories?from=2026-10-05&to=2026-10-20"),
    );
    const before = paths().length;
    pickDate("De", "2026-10-25");
    expect(await screen.findByText("Período inválido")).toBeInTheDocument();
    expect(paths()).toHaveLength(before);
    expect(screen.queryByText("Moradia")).not.toBeInTheDocument();
    pickDate("De", "2026-10-15");
    await waitFor(() => expect(screen.queryByText("Período inválido")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(paths().at(-1)).toBe("/dashboard/categories?from=2026-10-15&to=2026-10-20"),
    );
  });

  it("renders the Estorno as a negative, highlighted value outside the positive shares", async () => {
    responses.set(KEY, distribution);
    renderWithQuery(<CategoryBreakdown />);
    await screen.findByText("Estorno (de compras)");
    const estorno = row("Estorno (de compras)");
    expect(within(estorno).getByText("-R$ 50,00")).toBeInTheDocument();
    expect(estorno).toHaveAttribute("data-reversal", "true");
    expect(within(estorno).getByText("—")).toBeInTheDocument();
    expect(row("Moradia")).not.toHaveAttribute("data-reversal");
    // Shares of the positive rows still add up to 100%: the Estorno is not in the base.
    expect(within(row("Moradia")).getByText("60,0%")).toBeInTheDocument();
  });

  it("shows the empty state when the period has no expenses", async () => {
    responses.set(KEY, { items: [] });
    renderWithQuery(<CategoryBreakdown />);
    expect(await screen.findByText("Sem despesas no período")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a skeleton while loading and an error with retry", async () => {
    responses.set(KEY, () => new Promise(() => {}));
    const { unmount } = renderWithQuery(<CategoryBreakdown />);
    expect(screen.getByRole("status", { name: /Carregando/ })).toBeInTheDocument();
    unmount();
    responses.clear();
    failures.set(KEY, new ApiError("internal_error", "Technical English", 500));
    renderWithQuery(<CategoryBreakdown />);
    expect(await screen.findByText("Não foi possível carregar este painel.")).toBeInTheDocument();
    failures.clear();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Moradia")).toBeInTheDocument();
  });
});

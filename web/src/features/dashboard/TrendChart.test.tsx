import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { TrendPoint } from "@/lib/api/types";
import { failures, renderWithQuery, requests, resetSpy, responses } from "@/test/apiSpy";
import { TrendChart } from "./TrendChart";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
});

const KEY = "GET /dashboard/trend";

// Oct/2025 .. Sep/2026: activity only in 3 months, the other 9 are zero.
const months = [
  "2025-10",
  "2025-11",
  "2025-12",
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
];
const zero = (month: string): TrendPoint => ({
  month,
  income: "0.00",
  expense: "0.00",
  balance: "0.00",
});
const withActivity: TrendPoint[] = months.map((month) => {
  if (month === "2025-12")
    return { month, income: "1000.00", expense: "300.00", balance: "700.00" };
  if (month === "2026-03")
    return { month, income: "500.00", expense: "800.00", balance: "-300.00" };
  if (month === "2026-09")
    return { month, income: "2500.50", expense: "100.00", balance: "2400.50" };
  return zero(month);
});

const rows = () =>
  within(screen.getByRole("table", { name: /12 meses/ }))
    .getAllByRole("row")
    .slice(1);

describe("TrendChart", () => {
  it("renders the 12 months, including the months with no transactions as R$ 0,00", async () => {
    responses.set(KEY, { points: withActivity });
    renderWithQuery(<TrendChart />);
    await screen.findByRole("table", { name: /12 meses/ });
    expect(rows()).toHaveLength(12);
    expect(rows().map((row) => within(row).getAllByRole("cell")[0]?.textContent)).toEqual([
      "out/25",
      "nov/25",
      "dez/25",
      "jan/26",
      "fev/26",
      "mar/26",
      "abr/26",
      "mai/26",
      "jun/26",
      "jul/26",
      "ago/26",
      "set/26",
    ]);
    const zeroRow = within(rows()[0] as HTMLElement).getAllByRole("cell");
    expect(zeroRow.slice(1).map((cell) => cell.textContent)).toEqual([
      "R$ 0,00",
      "R$ 0,00",
      "R$ 0,00",
    ]);
    expect(requests).toEqual([{ method: "GET", path: "/dashboard/trend", body: undefined }]);
  });

  it("shows the income, expense and balance series of each month", async () => {
    responses.set(KEY, { points: withActivity });
    renderWithQuery(<TrendChart />);
    await screen.findByRole("table", { name: /12 meses/ });
    expect(screen.getByRole("columnheader", { name: "Receitas" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Despesas" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Balanço" })).toBeInTheDocument();
    const march = within(rows()[5] as HTMLElement).getAllByRole("cell");
    expect(march.map((cell) => cell.textContent)).toEqual([
      "mar/26",
      "R$ 500,00",
      "R$ 800,00",
      "-R$ 300,00",
    ]);
    const september = within(rows()[11] as HTMLElement).getAllByRole("cell");
    expect(september.map((cell) => cell.textContent)).toEqual([
      "set/26",
      "R$ 2.500,50",
      "R$ 100,00",
      "R$ 2.400,50",
    ]);
  });

  it("shows a skeleton while loading and an error with retry when the request fails", async () => {
    responses.set(KEY, () => new Promise(() => {}));
    const { unmount } = renderWithQuery(<TrendChart />);
    expect(screen.getByRole("status", { name: /Carregando/ })).toBeInTheDocument();
    unmount();
    responses.clear();
    failures.set(KEY, new ApiError("internal_error", "Technical English", 500));
    renderWithQuery(<TrendChart />);
    expect(await screen.findByText("Não foi possível carregar este painel.")).toBeInTheDocument();
    failures.clear();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("table", { name: /12 meses/ });
    expect(rows()).toHaveLength(12);
  });
});

import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { Trend, TrendPoint } from "@/lib/api/types";
import { failures, renderWithQuery, requests, resetSpy, responses } from "@/test/apiSpy";
import { pickDate } from "@/test/datePicker";
import { TrendChart } from "./TrendChart";

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

const withTotals = (points: TrendPoint[], totals: Trend["totals"]): Trend => ({ points, totals });
const activityTotals = { income: "4000.50", expense: "1200.00", balance: "2800.50" };
const trendPaths = () =>
  requests.filter((request) => request.path.startsWith("/dashboard/trend")).map((r) => r.path);

const rows = () =>
  within(screen.getByRole("table", { name: /12 meses/ }))
    .getAllByRole("row")
    .slice(1);

describe("TrendChart", () => {
  it("renders the 12 months, including the months with no transactions as R$ 0,00", async () => {
    responses.set(KEY, withTotals(withActivity, activityTotals));
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
    expect(trendPaths()).toEqual(["/dashboard/trend"]);
  });

  it("shows the income, expense and balance series of each month", async () => {
    responses.set(KEY, withTotals(withActivity, activityTotals));
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

const YEARS = "GET /dashboard/years";
const choose = async (label: string, option: string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole("option", { name: option }));
};
const yearButton = (year: number) => screen.getByRole("button", { name: String(year) });
const loaded = async () => {
  renderWithQuery(<TrendChart />);
  await screen.findByRole("table", { name: /12 meses/ });
};

describe("TrendChart summary of the period", () => {
  it("shows receitas, despesas and balanço exactly as the API totals, without adding the points up", async () => {
    responses.set(
      KEY,
      withTotals(withActivity, { income: "12345.67", expense: "890.10", balance: "11455.57" }),
    );
    await loaded();
    const summary = within(screen.getByLabelText("Resumo do período"));
    expect(summary.getByText("Receitas").nextElementSibling).toHaveTextContent("R$ 12.345,67");
    expect(summary.getByText("Despesas").nextElementSibling).toHaveTextContent("R$ 890,10");
    expect(summary.getByText("Balanço").nextElementSibling).toHaveTextContent("R$ 11.455,57");
  });

  it.each([
    ["1000.00", "R$ 1.000,00", "text-emerald-700"],
    ["-300.00", "-R$ 300,00", "text-red-700"],
    ["0.00", "R$ 0,00", "text-foreground"],
  ])("colors a balance of %s by its sign (%s with %s)", async (balance, text, tone) => {
    responses.set(KEY, withTotals(withActivity, { income: "1.00", expense: "1.00", balance }));
    await loaded();
    const value = within(screen.getByLabelText("Resumo do período")).getByText(
      "Balanço",
    ).nextElementSibling;
    expect(value).toHaveTextContent(text);
    expect(value).toHaveClass(tone);
  });

  it("shows the totals of the period that was requested", async () => {
    responses.set(KEY, () => {
      const chosen = trendPaths().at(-1) !== "/dashboard/trend";
      return withTotals(withActivity, {
        income: chosen ? "10.00" : "20.00",
        expense: "1.00",
        balance: "9.00",
      });
    });
    await loaded();
    expect(screen.getByText("R$ 20,00")).toBeInTheDocument();
    await choose("Período", "Mês anterior");
    expect(await screen.findByText("R$ 10,00")).toBeInTheDocument();
  });
});

describe("TrendChart period and year shortcuts", () => {
  it("opens on the rolling 12 months and sends no period", async () => {
    await loaded();
    expect(trendPaths()).toEqual(["/dashboard/trend"]);
    expect(screen.getByLabelText("Período")).toHaveTextContent("Últimos 12 meses");
  });

  it("sends the range of the chosen preset and goes back to no parameters on the rolling option", async () => {
    await loaded();
    await choose("Período", "Mês anterior");
    await waitFor(() =>
      expect(trendPaths().at(-1)).toBe("/dashboard/trend?from=2026-09-01&to=2026-09-30"),
    );
    await choose("Período", "Últimos 12 meses");
    await waitFor(() => expect(trendPaths().at(-1)).toBe("/dashboard/trend"));
  });

  it("month and year send the first and last day of the month", async () => {
    responses.set(YEARS, { years: [2028, 2026] });
    await loaded();
    await choose("Período", "Mês e ano");
    await choose("Mês", "Fevereiro");
    await choose("Ano", "2028");
    await waitFor(() =>
      expect(trendPaths().at(-1)).toBe("/dashboard/trend?from=2028-02-01&to=2028-02-29"),
    );
  });

  it("a custom period sends a request only when both dates are set and in order", async () => {
    await loaded();
    await choose("Período", "Personalizado");
    pickDate("De", "2026-10-05");
    expect(trendPaths()).toHaveLength(1);
    pickDate("Até", "2026-10-20");
    await waitFor(() =>
      expect(trendPaths().at(-1)).toBe("/dashboard/trend?from=2026-10-05&to=2026-10-20"),
    );
    const before = trendPaths().length;
    pickDate("De", "2026-10-25");
    expect(await screen.findByText("Período inválido")).toBeInTheDocument();
    expect(trendPaths()).toHaveLength(before);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers one button per year the API returns, in its order, and none without years", async () => {
    responses.set(YEARS, { years: [2026, 2025, 2023] });
    await loaded();
    const group = await screen.findByRole("group", { name: "Atalhos de ano" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["2026", "2025", "2023"]);
    cleanup();
    responses.set(YEARS, { years: [] });
    await loaded();
    await waitFor(() => expect(trendPaths().length).toBeGreaterThan(0));
    expect(screen.queryByRole("group", { name: "Atalhos de ano" })).not.toBeInTheDocument();
  });

  it("choosing a year sends January to December, marks it, and clicking it again clears it", async () => {
    responses.set(YEARS, { years: [2026, 2025, 2023] });
    await loaded();
    await screen.findByRole("group", { name: "Atalhos de ano" });
    expect(yearButton(2025)).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(yearButton(2025));
    await waitFor(() =>
      expect(trendPaths().at(-1)).toBe("/dashboard/trend?from=2025-01-01&to=2025-12-31"),
    );
    expect(yearButton(2025)).toHaveAttribute("aria-pressed", "true");
    expect(yearButton(2026)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("De")).toHaveTextContent("01/01/2025");
    expect(screen.getByLabelText("Até")).toHaveTextContent("31/12/2025");
    fireEvent.click(yearButton(2023));
    await waitFor(() =>
      expect(trendPaths().at(-1)).toBe("/dashboard/trend?from=2023-01-01&to=2023-12-31"),
    );
    expect(yearButton(2025)).toHaveAttribute("aria-pressed", "false");
    expect(yearButton(2023)).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(yearButton(2023));
    await waitFor(() => expect(trendPaths().at(-1)).toBe("/dashboard/trend"));
    expect(yearButton(2023)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Período")).toHaveTextContent("Últimos 12 meses");
  });

  it("changing the period unmarks the year shortcut", async () => {
    responses.set(YEARS, { years: [2026] });
    await loaded();
    await screen.findByRole("group", { name: "Atalhos de ano" });
    fireEvent.click(yearButton(2026));
    await waitFor(() => expect(yearButton(2026)).toHaveAttribute("aria-pressed", "true"));
    await choose("Período", "Mês atual");
    expect(yearButton(2026)).toHaveAttribute("aria-pressed", "false");
    await waitFor(() =>
      expect(trendPaths().at(-1)).toBe("/dashboard/trend?from=2026-10-01&to=2026-10-31"),
    );
  });

  it("describes the table as the chosen period once a period is on", async () => {
    await loaded();
    await choose("Período", "Mês atual");
    expect(
      await screen.findByRole("table", {
        name: "Receitas, despesas e balanço do período escolhido",
      }),
    ).toBeInTheDocument();
  });
});

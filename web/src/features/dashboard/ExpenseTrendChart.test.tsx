import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { ExpenseTrend } from "@/lib/api/types";
import { failures, renderWithQuery, requests, resetSpy, responses } from "@/test/apiSpy";
import { pickDate } from "@/test/datePicker";
import { ExpenseTooltip, ExpenseTrendChart } from "./ExpenseTrendChart";
import { formatMonth } from "./months";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));
// Recharts measures its container, which jsdom cannot: give the chart a fixed size so it draws its SVG.
vi.mock("recharts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("recharts")>()),
  ResponsiveContainer: ({ children }: { children: ReactElement }) =>
    cloneElement(children, { width: 800, height: 320 } as object),
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

const KEY = "GET /dashboard/expense-trend";
const YEARS = "GET /dashboard/years";
const HOUSING = "70000000-0000-4000-8000-000000000002";
const FOOD = "70000000-0000-4000-8000-000000000001";
const REVERSAL = "70000000-0000-4000-8000-000000000004";

const trend: ExpenseTrend = {
  months: ["2026-08", "2026-09", "2026-10"],
  categories: [
    { categoryId: HOUSING, name: "Moradia", color: "orange-400" },
    { categoryId: FOOD, name: "Alimentação", color: "emerald-400" },
    { categoryId: REVERSAL, name: "Estorno (de compras)", color: "rose-400" },
  ],
  points: [
    { month: "2026-08", values: { [HOUSING]: "1200.00", [FOOD]: "0.00", [REVERSAL]: "0.00" } },
    { month: "2026-09", values: { [HOUSING]: "1200.00", [FOOD]: "300.50", [REVERSAL]: "0.00" } },
    { month: "2026-10", values: { [HOUSING]: "1200.00", [FOOD]: "250.00", [REVERSAL]: "-45.90" } },
  ],
};
const paths = () =>
  requests
    .filter((request) => request.path.startsWith("/dashboard/expense-trend"))
    .map((r) => r.path);
const loaded = async () => {
  renderWithQuery(<ExpenseTrendChart />);
  return screen.findByRole("table", { name: /Despesas por categoria/ });
};
const choose = async (label: string, option: string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole("option", { name: option }));
};

describe("ExpenseTrendChart", () => {
  it("opens on the rolling 12 months with no parameters and lists a column per category and a row per month", async () => {
    responses.set(KEY, trend);
    const table = within(await loaded());
    expect(paths()).toEqual(["/dashboard/expense-trend"]);
    expect(table.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Mês",
      "Moradia",
      "Alimentação",
      "Estorno (de compras)",
    ]);
    const rows = table.getAllByRole("row").slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((c) => c.textContent),
      ),
    ).toEqual([
      ["ago/26", "R$ 1.200,00", "R$ 0,00", "R$ 0,00"],
      ["set/26", "R$ 1.200,00", "R$ 300,50", "R$ 0,00"],
      ["out/26", "R$ 1.200,00", "R$ 250,00", "-R$ 45,90"],
    ]);
  });

  it("draws one stacked series per category, in the API order, with a legend entry each", async () => {
    responses.set(KEY, trend);
    const table = await loaded();
    const card = table.closest("section") as HTMLElement;
    const bars = [...card.querySelectorAll(".recharts-bar")];
    expect(bars).toHaveLength(3);
    // one legend entry per category, named by the category
    const legend = card.querySelector(".recharts-legend-wrapper") as HTMLElement;
    expect(
      [...legend.querySelectorAll(":scope > div > div")].map((item) => item.textContent),
    ).toEqual(["Moradia", "Alimentação", "Estorno (de compras)"]);
    // all in the same stack: at one month the three rectangles share the same x
    const xs = [...card.querySelectorAll(".recharts-bar-rectangle path")].map((rect) =>
      rect.getAttribute("x"),
    );
    expect(new Set(xs).size).toBeLessThan(xs.length);
  });

  it("paints each series with the theme variable of its category color through the chart style", async () => {
    responses.set(KEY, trend);
    const card = (await loaded()).closest("section") as HTMLElement;
    const style = (card.querySelector("style") as HTMLStyleElement).textContent ?? "";
    expect(style).toContain(`--color-${HOUSING}: var(--color-orange-400);`);
    expect(style).toContain(`--color-${FOOD}: var(--color-emerald-400);`);
    expect(style).toContain(`--color-${REVERSAL}: var(--color-rose-400);`);
    const fills = [...card.querySelectorAll(".recharts-bar-rectangle path")].map((rect) =>
      rect.getAttribute("fill"),
    );
    expect(new Set(fills)).toEqual(
      new Set([`var(--color-${HOUSING})`, `var(--color-${FOOD})`, `var(--color-${REVERSAL})`]),
    );
  });

  it("falls back to the default color for an unknown color key", async () => {
    responses.set(KEY, {
      ...trend,
      categories: [{ categoryId: HOUSING, name: "Moradia", color: "not-a-color" }],
    });
    const card = (await loaded()).closest("section") as HTMLElement;
    expect(card.querySelector("style")?.textContent).toContain(
      `--color-${HOUSING}: var(--color-slate-400);`,
    );
  });

  it("draws the negative Estorno below the zero line, apart from the positive stack", async () => {
    responses.set(KEY, trend);
    const card = (await loaded()).closest("section") as HTMLElement;
    const rects = (id: string) =>
      [...card.querySelectorAll<SVGPathElement>(".recharts-bar-rectangle path")].filter(
        (rect) => rect.getAttribute("fill") === `var(--color-${id})`,
      );
    const [reversal] = rects(REVERSAL);
    expect(rects(REVERSAL)).toHaveLength(1);
    const baseline = Math.max(
      ...rects(HOUSING).map(
        (rect) => Number(rect.getAttribute("y")) + Number(rect.getAttribute("height")),
      ),
    );
    // SVG y grows downward: the reversal starts at the zero line (the foot of the positive bars)
    expect(Number(reversal?.getAttribute("y"))).toBeGreaterThanOrEqual(baseline - 0.5);
  });

  // Recharts does not react to synthetic mouse moves in jsdom, so the tooltip body is rendered the way
  // Recharts hands it a hovered month: the row of that month in `payload`.
  const tooltipFor = (index: number) => {
    const point = trend.points[index] as ExpenseTrend["points"][number];
    render(
      <ExpenseTooltip
        active
        categories={trend.categories}
        payload={[{ payload: { label: formatMonth(point.month), values: point.values } }]}
      />,
    );
    return screen.getByText(formatMonth(point.month)).parentElement as HTMLElement;
  };

  it("the tooltip lists the month's categories in BRL from the API strings, the Estorno negative", () => {
    const tooltip = tooltipFor(2);
    expect(tooltip).toHaveTextContent("Moradia: R$ 1.200,00");
    expect(tooltip).toHaveTextContent("Alimentação: R$ 250,00");
    expect(tooltip).toHaveTextContent("Estorno (de compras): -R$ 45,90");
  });

  it("the tooltip leaves out the categories with no spending in the month and says so when none", () => {
    const tooltip = tooltipFor(0);
    expect(tooltip).toHaveTextContent("Moradia: R$ 1.200,00");
    expect(tooltip).not.toHaveTextContent("Alimentação");
    expect(tooltip).not.toHaveTextContent("Estorno");
    cleanup();
    render(
      <ExpenseTooltip
        active
        categories={trend.categories}
        payload={[{ payload: { label: "x", values: {} } }]}
      />,
    );
    expect(screen.getByText("Sem despesas")).toBeInTheDocument();
  });

  it("shows the empty state when the period has no expenses", async () => {
    responses.set(KEY, {
      months: ["2026-10"],
      categories: [],
      points: [{ month: "2026-10", values: {} }],
    });
    renderWithQuery(<ExpenseTrendChart />);
    expect(await screen.findByText("Sem despesas no período")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a skeleton while loading and an error with retry", async () => {
    responses.set(KEY, () => new Promise(() => {}));
    const { unmount } = renderWithQuery(<ExpenseTrendChart />);
    expect(screen.getByRole("status", { name: /Carregando/ })).toBeInTheDocument();
    unmount();
    responses.clear();
    failures.set(KEY, new ApiError("internal_error", "Technical English", 500));
    renderWithQuery(<ExpenseTrendChart />);
    expect(await screen.findByText("Não foi possível carregar este painel.")).toBeInTheDocument();
    failures.clear();
    responses.set(KEY, trend);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      await screen.findByRole("table", { name: /Despesas por categoria/ }),
    ).toBeInTheDocument();
  });

  it("uses the same period, month/year and year shortcuts as the trend", async () => {
    responses.set(YEARS, { years: [2026, 2025] });
    responses.set(KEY, trend);
    await loaded();
    await choose("Período", "Mês anterior");
    await waitFor(() =>
      expect(paths().at(-1)).toBe("/dashboard/expense-trend?from=2026-09-01&to=2026-09-30"),
    );
    await choose("Período", "Mês e ano");
    await choose("Mês", "Fevereiro");
    await choose("Ano", "2025");
    await waitFor(() =>
      expect(paths().at(-1)).toBe("/dashboard/expense-trend?from=2025-02-01&to=2025-02-28"),
    );
    const year = await screen.findByRole("button", { name: "2025" });
    fireEvent.click(year);
    await waitFor(() =>
      expect(paths().at(-1)).toBe("/dashboard/expense-trend?from=2025-01-01&to=2025-12-31"),
    );
    expect(year).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(year);
    await waitFor(() => expect(paths().at(-1)).toBe("/dashboard/expense-trend"));
  });

  it("does not request an incomplete or inverted custom period", async () => {
    responses.set(KEY, trend);
    await loaded();
    await choose("Período", "Personalizado");
    pickDate("De", "2026-10-05");
    expect(paths()).toHaveLength(1);
    pickDate("Até", "2026-10-20");
    await waitFor(() =>
      expect(paths().at(-1)).toBe("/dashboard/expense-trend?from=2026-10-05&to=2026-10-20"),
    );
    const before = paths().length;
    pickDate("De", "2026-10-25");
    expect(await screen.findByText("Período inválido")).toBeInTheDocument();
    expect(paths()).toHaveLength(before);
  });
});

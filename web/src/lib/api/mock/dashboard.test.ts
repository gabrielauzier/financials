import { afterEach, describe, expect, it } from "vitest";
import type {
  CardView,
  CategoryDistribution,
  DashboardYears,
  InvestmentReturns,
  Last30Days,
  NetWorth,
  Trend,
} from "../types";
import { mockRequest } from "./index";
import { setMockDataMode } from "./dashboard";

afterEach(() => setMockDataMode("seeded"));

const get = <T>(path: string) => mockRequest<T>({ method: "GET", path });

describe("dashboard mocks follow the API contract", () => {
  it("returns the 12 months of history with balance = income - expense", async () => {
    const { points } = await get<Trend>("/dashboard/trend");
    expect(points).toHaveLength(12);
    expect(new Set(points.map((point) => point.month)).size).toBe(12);
    const now = new Date();
    expect(points[11]?.month).toBe(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    );
    expect(points[0]).toEqual({
      month: points[0]?.month,
      income: "5200.00",
      expense: "3900.00",
      balance: "1300.00",
    });
  });

  it("returns a negative reversal row for the current month and none for older periods", async () => {
    const { items } = await get<CategoryDistribution>("/dashboard/categories");
    expect(items.find((item) => item.name === "Estorno (de compras)")?.total).toBe("-45.90");
    const old = await get<CategoryDistribution>(
      "/dashboard/categories?from=2020-01-01&to=2020-01-31",
    );
    expect(old.items.some((item) => item.total.startsWith("-"))).toBe(false);
  });

  it("rejects from > to with invalid_period and half periods", async () => {
    await expect(get("/dashboard/categories?from=2026-10-10&to=2026-10-01")).rejects.toMatchObject({
      code: "invalid_period",
      status: 422,
    });
    await expect(get("/dashboard/card?from=2026-10-10")).rejects.toMatchObject({
      code: "invalid_period",
    });
  });

  it("returns the card view with 3 categories per section and a null changePct case", async () => {
    const card = await get<CardView>("/dashboard/card");
    expect(card.transactions).toHaveLength(3);
    expect(card.creditExpenses).toHaveLength(3);
    const last30 = await get<Last30Days>("/dashboard/last-30-days");
    expect(last30.changePct).toBe(23.4);
  });

  it("seeds 3 investment returns, one negative, newest first, reflected in net worth", async () => {
    const returns = await get<InvestmentReturns>("/investment-returns");
    expect(returns.items).toHaveLength(3);
    expect(returns.items.filter((item) => item.amount.startsWith("-"))).toHaveLength(1);
    expect(returns.lastDate).toBe(returns.items[0]?.occurredOn);
    const before = await get<NetWorth>("/dashboard/net-worth");
    expect(before.series).toHaveLength(12);
    expect(before.current).toBe(before.series[11]?.value);
    const account = returns.items[0]?.accountId as string;
    await mockRequest({
      method: "POST",
      path: "/investment-returns",
      body: { occurredOn: returns.lastDate, amount: "10.00", accountId: account },
    });
    const after = await get<NetWorth>("/dashboard/net-worth");
    expect(Number(after.current) - Number(before.current)).toBeCloseTo(10, 2);
  });

  it("validates investment returns like the API (zero, 3 decimals, account, date) and 404s", async () => {
    const [account] = (await get<InvestmentReturns>("/investment-returns")).items;
    const body = { occurredOn: "2026-10-01", amount: "5.00", accountId: account?.accountId };
    const post = (override: Record<string, unknown>) =>
      mockRequest({ method: "POST", path: "/investment-returns", body: { ...body, ...override } });
    await expect(post({ amount: "0.00" })).rejects.toMatchObject({ code: "invalid_amount" });
    await expect(post({ amount: "1.234" })).rejects.toMatchObject({ code: "invalid_amount" });
    await expect(post({ amount: 5 })).rejects.toMatchObject({ code: "invalid_amount" });
    await expect(post({ accountId: "nope" })).rejects.toMatchObject({ code: "invalid_account" });
    await expect(post({ occurredOn: "2026-02-31" })).rejects.toMatchObject({
      code: "invalid_date",
    });
    await expect(
      mockRequest({ method: "DELETE", path: "/investment-returns/unknown" }),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("'empty' mode returns zeros, empty lists and no returns", async () => {
    setMockDataMode("empty");
    expect(await get<Last30Days>("/dashboard/last-30-days")).toEqual({
      total: "0.00",
      previousTotal: "0.00",
      changePct: null,
    });
    const trend = await get<Trend>("/dashboard/trend");
    expect(trend.points).toHaveLength(12);
    expect(trend.points.every((point) => point.balance === "0.00")).toBe(true);
    expect(await get<CategoryDistribution>("/dashboard/categories")).toEqual({ items: [] });
    expect(await get<NetWorth>("/dashboard/net-worth")).toEqual({ current: "0.00", series: [] });
    expect(await get<CardView>("/dashboard/card")).toEqual({
      transactions: [],
      creditExpenses: [],
    });
    expect(await get<InvestmentReturns>("/investment-returns")).toEqual({
      items: [],
      lastDate: null,
    });
  });

  it("lists the years of the months with data, newest first, and none without data", async () => {
    const { years } = await get<DashboardYears>("/dashboard/years");
    const now = new Date().getFullYear();
    expect(years[0]).toBe(now);
    expect([...years].sort((a, b) => b - a)).toEqual(years);
    expect(new Set(years).size).toBe(years.length);
    setMockDataMode("empty");
    expect(await get<DashboardYears>("/dashboard/years")).toEqual({ years: [] });
  });

  it("answers a trend period with one point per month from the month of from to the month of to, and totals that add up", async () => {
    const { points, totals } = await get<Trend>("/dashboard/trend?from=2020-11-15&to=2021-02-03");
    expect(points.map((point) => point.month)).toEqual([
      "2020-11",
      "2020-12",
      "2021-01",
      "2021-02",
    ]);
    expect(totals).toEqual({ income: "0.00", expense: "0.00", balance: "0.00" });
    const rolling = await get<Trend>("/dashboard/trend");
    expect(rolling.totals.income).toBe("63650.00");
    expect(rolling.totals.expense).toBe("49150.50");
    expect(rolling.totals.balance).toBe("14499.50");
  });

  it("rejects a half trend period and a period of more than 120 months with invalid_period", async () => {
    await expect(get("/dashboard/trend?from=2026-01-01")).rejects.toMatchObject({
      code: "invalid_period",
    });
    await expect(get("/dashboard/trend?from=2010-01-01&to=2020-01-01")).rejects.toMatchObject({
      code: "invalid_period",
    });
    expect(
      (await get<Trend>("/dashboard/trend?from=2016-02-01&to=2026-01-31")).points,
    ).toHaveLength(120);
  });
});

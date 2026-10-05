import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { setMockDataMode } from "@/lib/api/mock/dashboard";
import { failures, renderWithQuery, requests, resetSpy } from "@/test/apiSpy";
import { DashboardPage } from "./DashboardPage";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

beforeEach(() => setMockDataMode("seeded"));
afterEach(() => {
  cleanup();
  resetSpy();
  setMockDataMode("seeded");
});

const panel = (name: string) => within(screen.getByRole("region", { name }));
const PANELS = [
  "Despesas dos últimos 30 dias",
  "Patrimônio",
  "Tendência de 12 meses",
  "Gastos por categoria",
  "Visão do cartão",
  "Rendimentos de investimentos",
];
const getsTo = (path: string) =>
  requests.filter((request) => request.method === "GET" && request.path.startsWith(path));

describe("DashboardPage", () => {
  it("renders every panel from the mocked API", async () => {
    renderWithQuery(<DashboardPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    for (const name of PANELS) expect(screen.getByRole("region", { name })).toBeInTheDocument();

    expect(
      await panel("Despesas dos últimos 30 dias").findByText("R$ 1.850,40"),
    ).toBeInTheDocument();
    expect(panel("Despesas dos últimos 30 dias").getByText("+23,4%")).toBeInTheDocument();

    const trend = await panel("Tendência de 12 meses").findByRole("table");
    expect(within(trend).getAllByRole("row")).toHaveLength(13);

    expect(await panel("Gastos por categoria").findByText("Moradia")).toBeInTheDocument();
    expect(panel("Gastos por categoria").getByText("-R$ 45,90")).toBeInTheDocument();

    const netWorth = await panel("Patrimônio").findByRole("table");
    expect(within(netWorth).getAllByRole("row")).toHaveLength(13);

    expect(
      await panel("Visão do cartão").findByText("Compras no cartão por categoria"),
    ).toBeInTheDocument();
    expect(
      panel("Visão do cartão").getByText("Parcelas e recorrências a pagar"),
    ).toBeInTheDocument();

    const returns = await panel("Rendimentos de investimentos").findByRole("table");
    expect(within(returns).getAllByRole("row")).toHaveLength(4);
    expect(within(returns).getByText(/^-R\$ 18,50$/)).toBeInTheDocument();

    const paths = requests.map((request) => request.path);
    expect(paths).toContain("/dashboard/last-30-days");
    expect(paths).toContain("/dashboard/trend");
    expect(paths).toContain("/dashboard/net-worth");
    expect(paths).toContain("/investment-returns");
    expect(
      paths.some((path) => /^\/dashboard\/categories\?from=\d{4}-\d{2}-01&to=/.test(path)),
    ).toBe(true);
    expect(paths.some((path) => /^\/dashboard\/card\?from=\d{4}-\d{2}-01&to=/.test(path))).toBe(
      true,
    );
  });

  it("with no data every panel shows R$ 0,00 or its empty state", async () => {
    setMockDataMode("empty");
    renderWithQuery(<DashboardPage />);
    expect(await panel("Despesas dos últimos 30 dias").findByText("R$ 0,00")).toBeInTheDocument();
    expect(
      panel("Despesas dos últimos 30 dias").getByText("sem base de comparação"),
    ).toBeInTheDocument();

    expect(await panel("Patrimônio").findByText("R$ 0,00")).toBeInTheDocument();
    expect(panel("Patrimônio").getByText("Ainda não há movimentações")).toBeInTheDocument();

    const trend = await panel("Tendência de 12 meses").findByRole("table");
    const cells = within(trend).getAllByRole("cell");
    expect(within(trend).getAllByRole("row")).toHaveLength(13);
    expect(cells.filter((cell) => cell.textContent === "R$ 0,00")).toHaveLength(36);

    expect(
      await panel("Gastos por categoria").findByText("Sem despesas no período"),
    ).toBeInTheDocument();
    expect(
      await panel("Visão do cartão").findByText("Sem compras no cartão no período"),
    ).toBeInTheDocument();
    expect(
      panel("Visão do cartão").getByText("Sem parcelas ou recorrências a pagar"),
    ).toBeInTheDocument();
    expect(
      await panel("Rendimentos de investimentos").findByText("Nenhum rendimento lançado"),
    ).toBeInTheDocument();
  });

  it("a panel that fails shows its error with retry while the others keep rendering", async () => {
    failures.set("GET /dashboard/trend", new ApiError("internal_error", "Technical English", 500));
    renderWithQuery(<DashboardPage />);
    expect(
      await panel("Tendência de 12 meses").findByText("Não foi possível carregar este painel."),
    ).toBeInTheDocument();
    expect(
      await panel("Despesas dos últimos 30 dias").findByText("R$ 1.850,40"),
    ).toBeInTheDocument();
    expect(await panel("Gastos por categoria").findByText("Moradia")).toBeInTheDocument();
    failures.clear();
    fireEvent.click(
      panel("Tendência de 12 meses").getByRole("button", { name: "Tentar novamente" }),
    );
    expect(await panel("Tendência de 12 meses").findByRole("table")).toBeInTheDocument();
    expect(getsTo("/dashboard/trend")).toHaveLength(2);
  });

  it("deleting an investment return refreshes the net worth shown in the page", async () => {
    renderWithQuery(<DashboardPage />);
    const returns = panel("Rendimentos de investimentos");
    const table = await returns.findByRole("table");
    await panel("Patrimônio").findByRole("table");
    const current = () =>
      panel("Patrimônio").getByText(/^-?R\$ [\d.]+,\d{2}$/, { selector: "p" }).textContent;
    const before = current();
    expect(getsTo("/dashboard/net-worth")).toHaveLength(1);

    fireEvent.click(
      within(table).getAllByRole("button", { name: /^Excluir rendimento de/ })[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(getsTo("/dashboard/net-worth")).toHaveLength(2));
    await waitFor(() => expect(current()).not.toBe(before));
    expect(within(await returns.findByRole("table")).getAllByRole("row")).toHaveLength(3);
  });
});

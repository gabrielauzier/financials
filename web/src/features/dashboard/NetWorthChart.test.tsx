import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { failures, renderWithQuery, requests, resetSpy, responses } from "@/test/apiSpy";
import { NetWorthChart } from "./NetWorthChart";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
});

const KEY = "GET /dashboard/net-worth";

describe("NetWorthChart", () => {
  it("shows the current value and the monthly cumulative series", async () => {
    responses.set(KEY, {
      current: "750.00",
      series: [
        { month: "2026-08", value: "-100.50" },
        { month: "2026-09", value: "700.00" },
        { month: "2026-10", value: "750.00" },
      ],
    });
    renderWithQuery(<NetWorthChart />);
    expect(await screen.findByText("R$ 750,00", { selector: "p" })).toBeInTheDocument();
    const rows = within(screen.getByRole("table", { name: /Patrimônio/ }))
      .getAllByRole("row")
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      );
    expect(rows).toEqual([
      ["ago/26", "-R$ 100,50"],
      ["set/26", "R$ 700,00"],
      ["out/26", "R$ 750,00"],
    ]);
    expect(screen.queryByText("Ainda não há movimentações")).not.toBeInTheDocument();
    expect(requests).toEqual([{ method: "GET", path: "/dashboard/net-worth", body: undefined }]);
  });

  it("shows R$ 0,00 and the empty state when there is no data", async () => {
    responses.set(KEY, { current: "0.00", series: [] });
    renderWithQuery(<NetWorthChart />);
    expect(await screen.findByText("R$ 0,00")).toBeInTheDocument();
    expect(screen.getByText("Ainda não há movimentações")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a skeleton while loading and an error with retry", async () => {
    responses.set(KEY, () => new Promise(() => {}));
    const { unmount } = renderWithQuery(<NetWorthChart />);
    expect(screen.getByRole("status", { name: /Carregando/ })).toBeInTheDocument();
    unmount();
    responses.clear();
    failures.set(KEY, new ApiError("internal_error", "Technical English", 500));
    renderWithQuery(<NetWorthChart />);
    expect(await screen.findByText("Não foi possível carregar este painel.")).toBeInTheDocument();
    failures.clear();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("table", { name: /Patrimônio/ })).toBeInTheDocument();
  });
});

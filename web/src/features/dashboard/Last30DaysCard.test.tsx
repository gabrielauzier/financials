import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { failures, renderWithQuery, requests, resetSpy, responses } from "@/test/apiSpy";
import { Last30DaysCard } from "./Last30DaysCard";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
});

const KEY = "GET /dashboard/last-30-days";

describe("Last30DaysCard", () => {
  it("shows the total and the variation against the previous 30 days", async () => {
    responses.set(KEY, { total: "150.00", previousTotal: "100.00", changePct: 50 });
    renderWithQuery(<Last30DaysCard />);
    expect(await screen.findByText("R$ 150,00")).toBeInTheDocument();
    expect(screen.getByText("+50,0%")).toBeInTheDocument();
    expect(screen.queryByText("sem base de comparação")).not.toBeInTheDocument();
    expect(requests).toEqual([{ method: "GET", path: "/dashboard/last-30-days", body: undefined }]);
  });

  it("shows an expense increase in red and a reduction in green", async () => {
    responses.set(KEY, { total: "150.00", previousTotal: "100.00", changePct: 50 });
    const { unmount } = renderWithQuery(<Last30DaysCard />);
    expect((await screen.findByText("+50,0%")).closest("p")).toHaveClass("text-red-600");
    unmount();
    responses.set(KEY, { total: "80.00", previousTotal: "100.00", changePct: -20 });
    renderWithQuery(<Last30DaysCard />);
    expect((await screen.findByText("-20,0%")).closest("p")).toHaveClass("text-green-600");
  });

  it("shows 'sem base de comparação' instead of the variation when changePct is null", async () => {
    responses.set(KEY, { total: "150.00", previousTotal: "0.00", changePct: null });
    renderWithQuery(<Last30DaysCard />);
    expect(await screen.findByText("R$ 150,00")).toBeInTheDocument();
    expect(screen.getByText("sem base de comparação")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("shows R$ 0,00 when there are no expenses in the window", async () => {
    responses.set(KEY, { total: "0.00", previousTotal: "0.00", changePct: null });
    renderWithQuery(<Last30DaysCard />);
    expect(await screen.findByText("R$ 0,00")).toBeInTheDocument();
    expect(screen.getByText("sem base de comparação")).toBeInTheDocument();
  });

  it("shows a skeleton while loading", () => {
    responses.set(KEY, () => new Promise(() => {}));
    renderWithQuery(<Last30DaysCard />);
    expect(screen.getByRole("status", { name: /Carregando/ })).toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it("shows an error with 'Tentar novamente' that loads the card again", async () => {
    failures.set(KEY, new ApiError("internal_error", "Technical English", 500));
    renderWithQuery(<Last30DaysCard />);
    expect(await screen.findByText("Não foi possível carregar este painel.")).toBeInTheDocument();
    expect(screen.queryByText(/Technical English/)).not.toBeInTheDocument();
    failures.clear();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("R$ 1.850,40")).toBeInTheDocument();
    expect(requests).toHaveLength(2);
  });
});

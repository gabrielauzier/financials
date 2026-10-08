import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { ExpenseSearch } from "@/lib/api/types";
import { failures, renderWithQuery, requests, resetSpy, responses } from "@/test/apiSpy";
import { ExpenseTracker } from "./ExpenseTracker";

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

afterEach(() => {
  cleanup();
  resetSpy();
});

const KEY = "GET /dashboard/expense-search";
const result: ExpenseSearch = {
  points: [
    { month: "2026-08", total: "55.90" },
    { month: "2026-09", total: "0.00" },
    { month: "2026-10", total: "111.80" },
  ],
  total: "167.70",
  count: 3,
};
const searches = () =>
  requests.filter((request) => request.path.startsWith("/dashboard/expense-search"));
const field = () => screen.getByLabelText("Nome ou descrição");
const button = () => screen.getByRole("button", { name: "Pesquisar" });
const type = (text: string) => fireEvent.change(field(), { target: { value: text } });
const rows = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );

describe("ExpenseTracker", () => {
  it("before any search shows the instruction, no chart and no request, with the button disabled", () => {
    renderWithQuery(<ExpenseTracker />);
    expect(
      screen.getByText(/Pesquise uma despesa pelo nome ou pela descrição/),
    ).toBeInTheDocument();
    expect(button()).toBeDisabled();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(searches()).toHaveLength(0);
  });

  it("typing alone never queries; the button sends the trimmed term once", async () => {
    responses.set(KEY, result);
    renderWithQuery(<ExpenseTracker />);
    type("  Netflix ");
    expect(button()).toBeEnabled();
    expect(searches()).toHaveLength(0);
    fireEvent.click(button());
    await screen.findByRole("table");
    expect(searches().map((request) => request.path)).toEqual([
      "/dashboard/expense-search?q=Netflix",
    ]);
    // editing the field after the search neither refetches nor changes the results shown
    type("Spotify");
    expect(searches()).toHaveLength(1);
    expect(screen.getByText("Total acumulado de “Netflix”")).toBeInTheDocument();
  });

  it("Enter in the field searches like the button, and a second term replaces the first", async () => {
    responses.set(KEY, result);
    renderWithQuery(<ExpenseTracker />);
    type("Netflix");
    fireEvent.keyDown(field(), { key: "Enter" });
    await screen.findByRole("table");
    type("Spotify");
    fireEvent.keyDown(field(), { key: "Enter" });
    await screen.findByText("Total acumulado de “Spotify”");
    expect(searches().map((request) => request.path)).toEqual([
      "/dashboard/expense-search?q=Netflix",
      "/dashboard/expense-search?q=Spotify",
    ]);
  });

  it("a blank or whitespace-only field disables the button and Enter sends nothing", () => {
    renderWithQuery(<ExpenseTracker />);
    expect(button()).toBeDisabled();
    type("   ");
    expect(button()).toBeDisabled();
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(searches()).toHaveLength(0);
    type("a");
    expect(button()).toBeEnabled();
    type("");
    expect(button()).toBeDisabled();
  });

  it("encodes the term in the query and limits the field to 80 characters", async () => {
    responses.set(KEY, result);
    renderWithQuery(<ExpenseTracker />);
    expect(field()).toHaveAttribute("maxlength", "80");
    type("café & 100%");
    fireEvent.click(button());
    await screen.findByRole("table");
    expect(searches()[0]?.path).toBe("/dashboard/expense-search?q=caf%C3%A9%20%26%20100%25");
  });

  it("shows the accumulated total, the transaction count, the monthly line and its table", async () => {
    responses.set(KEY, result);
    renderWithQuery(<ExpenseTracker />);
    type("Netflix");
    fireEvent.click(button());
    expect(await screen.findByText("R$ 167,70")).toBeInTheDocument();
    expect(screen.getByText("3 transações")).toBeInTheDocument();
    expect(rows()).toEqual([
      ["ago/26", "R$ 55,90"],
      ["set/26", "R$ 0,00"],
      ["out/26", "R$ 111,80"],
    ]);
    const card = screen.getByRole("table").closest("section") as HTMLElement;
    expect(card.querySelectorAll(".recharts-line")).toHaveLength(1);
    expect(card.querySelectorAll(".recharts-line-dot")).toHaveLength(3);
  });

  it("says 1 transação in the singular", async () => {
    responses.set(KEY, { points: [{ month: "2026-10", total: "9.90" }], total: "9.90", count: 1 });
    renderWithQuery(<ExpenseTracker />);
    type("Café");
    fireEvent.click(button());
    expect(await screen.findByText("1 transação")).toBeInTheDocument();
  });

  it("shows a no-match message with the term and no chart when nothing matches", async () => {
    responses.set(KEY, { points: [], total: "0.00", count: 0 });
    renderWithQuery(<ExpenseTracker />);
    type("xyzzy");
    fireEvent.click(button());
    expect(await screen.findByText("Nenhuma despesa encontrada para “xyzzy”")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
  });

  it("shows a skeleton while searching and an error with retry that repeats the same search", async () => {
    responses.set(KEY, () => new Promise(() => {}));
    const { unmount } = renderWithQuery(<ExpenseTracker />);
    type("Netflix");
    fireEvent.click(button());
    expect(await screen.findByRole("status", { name: /Carregando/ })).toBeInTheDocument();
    unmount();
    responses.clear();
    failures.set(KEY, new ApiError("internal_error", "Technical English", 500));
    renderWithQuery(<ExpenseTracker />);
    type("Netflix");
    fireEvent.click(button());
    expect(await screen.findByText("Não foi possível carregar este painel.")).toBeInTheDocument();
    expect(screen.queryByText(/Technical English/)).not.toBeInTheDocument();
    failures.clear();
    responses.set(KEY, result);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("R$ 167,70")).toBeInTheDocument();
    expect(searches().at(-1)?.path).toBe("/dashboard/expense-search?q=Netflix");
  });

  it("searching the same term again repeats the request", async () => {
    responses.set(KEY, result);
    renderWithQuery(<ExpenseTracker />);
    type("Netflix");
    fireEvent.click(button());
    await screen.findByRole("table");
    fireEvent.click(button());
    await waitFor(() => expect(searches()).toHaveLength(2));
  });

  it("works against the mock: case and accent insensitive, name or description", async () => {
    renderWithQuery(<ExpenseTracker />);
    type("CAFE");
    fireEvent.click(button());
    expect(await screen.findByText("2 transações")).toBeInTheDocument();
    expect(screen.getByText("R$ 25,00")).toBeInTheDocument();
    type("assinatura MUSICA");
    fireEvent.click(button());
    expect(await screen.findByText("4 transações")).toBeInTheDocument();
    expect(screen.getByText("R$ 87,60")).toBeInTheDocument();
  });
});

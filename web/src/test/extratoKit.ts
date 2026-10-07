import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { mockRequest } from "@/lib/api/mock";
import type { PageSize, TransactionsPage as Page, TransactionSummary } from "@/lib/api/types";
import { requests, responses } from "./apiSpy";

/** Helpers shared by the extrato tests that read the requests the page sends (through the `apiSpy` log). */

/** The pickers open on the month of this clock (June 2026); timers are faked so the 300 ms search debounce is moved by hand. */
export const NOW = new Date(2026, 5, 15, 12);
export const fakeClock = () => vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });

export const listPaths = () =>
  requests
    .filter((request) => request.method === "GET" && request.path.startsWith("/transactions?"))
    .map((request) => request.path);
export const summaryPaths = () =>
  requests
    .filter(
      (request) => request.method === "GET" && request.path.startsWith("/transactions/summary"),
    )
    .map((request) => request.path);
const paramsOf = (path: string) =>
  Object.fromEntries(new URLSearchParams(path.split("?")[1] ?? "").entries());
/** The parameters of the last list query, so the checks do not depend on their order. */
export const lastListParams = () => paramsOf(listPaths().at(-1) ?? "");
export const lastSummaryParams = () => paramsOf(summaryPaths().at(-1) ?? "");

export const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
export const flush = () => act(async () => {});

export const TOTAL = 120;
/**
 * The list answers with three rows, a fixed total and the page and page size it was asked for: re-rendering 50
 * rows and 50 cards on every change would take most of each test's time, and the tests check the queries.
 */
export async function lightList(options: { total?: number; pageSize?: PageSize } = {}) {
  const rows = (await mockRequest<Page>({ method: "GET", path: "/transactions" })).items;
  responses.set("GET /transactions", () => ({
    items: options.total === 0 ? [] : rows.slice(0, 3),
    total: options.total ?? TOTAL,
    page: Number(lastListParams()["page"] ?? 1),
    pageSize: options.pageSize ?? Number(lastListParams()["pageSize"] ?? 50),
  }));
}

/**
 * Shrinks the in-memory mock to `keep` transactions (call it in `beforeAll`: the mock is module state, so a test
 * file starts from 120 rows and the page would render 50 of them, twice, on every change). For the tests that
 * need the page itself (a real row to edit or delete) rather than a canned list; they seed what they check.
 */
export async function trimTransactions(keep = 3) {
  const all: Page["items"] = [];
  for (let page = 1; ; page++) {
    const result = await mockRequest<Page>({
      method: "GET",
      path: `/transactions?page=${page}&pageSize=100`,
    });
    all.push(...result.items);
    if (all.length >= result.total || result.items.length === 0) break;
  }
  for (const item of all.slice(keep)) {
    await mockRequest({ method: "DELETE", path: `/transactions/${item.id}` });
  }
}

export const SUMMARY: TransactionSummary = {
  count: TOTAL,
  income: "1234.56",
  expense: "100.00",
  investments: "50.00",
  balance: "1134.56",
};
export const cannedSummary = (over: Partial<TransactionSummary> = {}) =>
  responses.set("GET /transactions/summary", { ...SUMMARY, ...over });

export const chooseOption = async (label: string, option: string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole("option", { name: option }));
};
export const waitForList = (check: (params: Record<string, string>) => void) =>
  waitFor(() => check(lastListParams()));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { mockRequest } from "@/lib/api/mock";
import { setMockDataMode } from "@/lib/api/mock/dashboard";
import type { Account, InvestmentReturn } from "@/lib/api/types";
import { failures, requests, resetSpy } from "@/test/apiSpy";
import {
  useCreateInvestmentReturn,
  useDeleteInvestmentReturn,
  useInvestmentReturns,
  useUpdateInvestmentReturn,
} from "./hooks";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

beforeEach(() => setMockDataMode("seeded"));
afterEach(() => {
  cleanup();
  resetSpy();
});

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper, invalidate };
}

const account = async () =>
  (await mockRequest<Account[]>({ method: "GET", path: "/accounts" }))[0] as Account;
const seed = async () =>
  mockRequest<InvestmentReturn>({
    method: "POST",
    path: "/investment-returns",
    body: { occurredOn: "2031-01-20", amount: "10.00", accountId: (await account()).id },
  });
const netWorthKey = { queryKey: ["dashboard", "net-worth"] };

describe("investment returns hooks", () => {
  it("lists from GET /investment-returns", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useInvestmentReturns(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requests.map((request) => request.path)).toEqual(["/investment-returns"]);
    expect(result.current.data?.items).toHaveLength(3);
  });

  it("create posts the body and invalidates the list and the net worth", async () => {
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useCreateInvestmentReturn(), { wrapper });
    const body = { occurredOn: "2031-02-01", amount: "-5.00", accountId: (await account()).id };
    await act(() => result.current.mutateAsync(body));
    expect(requests).toEqual([{ method: "POST", path: "/investment-returns", body }]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["investmentReturns"] });
    expect(invalidate).toHaveBeenCalledWith(netWorthKey);
  });

  it("update sends the partial PATCH and invalidates the list and the net worth", async () => {
    const item = await seed();
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useUpdateInvestmentReturn(), { wrapper });
    await act(() => result.current.mutateAsync({ id: item.id, input: { amount: "11.00" } }));
    expect(requests).toEqual([
      { method: "PATCH", path: `/investment-returns/${item.id}`, body: { amount: "11.00" } },
    ]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["investmentReturns"] });
    expect(invalidate).toHaveBeenCalledWith(netWorthKey);
  });

  it("delete calls DELETE and invalidates the list and the net worth", async () => {
    const item = await seed();
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useDeleteInvestmentReturn(), { wrapper });
    await act(() => result.current.mutateAsync(item.id));
    expect(requests).toEqual([
      { method: "DELETE", path: `/investment-returns/${item.id}`, body: undefined },
    ]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["investmentReturns"] });
    expect(invalidate).toHaveBeenCalledWith(netWorthKey);
  });

  it("update rolls the cached list back when the PATCH and the refetch both fail", async () => {
    const item = await seed();
    const { wrapper } = setup();
    const { result } = renderHook(
      () => ({ list: useInvestmentReturns(), update: useUpdateInvestmentReturn() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    failures.set("PATCH /investment-returns/:id", new ApiError("invalid_amount", "x", 422));
    failures.set("GET /investment-returns", new Error("refetch failed"));
    await act(async () => {
      await result.current.update
        .mutateAsync({ id: item.id, input: { amount: "99.00" } })
        .catch(() => {});
    });
    await waitFor(() =>
      expect(requests.filter((request) => request.method === "GET")).toHaveLength(2),
    );
    expect(result.current.list.data?.items.find((row) => row.id === item.id)?.amount).toBe("10.00");
  });
});

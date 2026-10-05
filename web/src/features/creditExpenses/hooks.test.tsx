import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockRequest } from "@/lib/api/mock";
import type { Account, CreditExpense } from "@/lib/api/types";
import { requests, resetSpy } from "@/test/apiSpy";
import {
  useCreateCreditExpense,
  useCreditExpenses,
  useDeleteCreditExpense,
  useUpdateCreditExpense,
} from "./hooks";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

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
  return { wrapper, invalidate };
}

const account = async () =>
  (await mockRequest<Account[]>({ method: "GET", path: "/accounts?active=true" }))[0] as Account;
const seed = async (name: string) =>
  mockRequest<CreditExpense>({
    method: "POST",
    path: "/credit-expenses",
    body: {
      name,
      totalAmount: "600.00",
      paidAmount: "200.00",
      occurredAt: "2031-01-20T15:00:00Z",
      recurrencyDay: 7,
      status: "Active",
      accountId: (await account()).id,
    },
  });

describe("credit expenses hooks", () => {
  it("lists without the status param and with it when a status filter is set", async () => {
    const { wrapper } = setup();
    const all = renderHook(() => useCreditExpenses({}), { wrapper });
    await waitFor(() => expect(all.result.current.isSuccess).toBe(true));
    expect(requests.map((request) => request.path)).toEqual(["/credit-expenses"]);

    const filtered = renderHook(() => useCreditExpenses({ status: "ToCancel" }), { wrapper });
    await waitFor(() => expect(filtered.result.current.isSuccess).toBe(true));
    expect(requests.map((request) => request.path)).toEqual([
      "/credit-expenses",
      "/credit-expenses?status=ToCancel",
    ]);
    expect(filtered.result.current.data?.length).toBeGreaterThan(0);
    expect(filtered.result.current.data?.every((item) => item.status === "ToCancel")).toBe(true);
    expect(all.result.current.data?.some((item) => item.status !== "ToCancel")).toBe(true);
  });

  it("create sends the body to POST /credit-expenses and invalidates the list", async () => {
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useCreateCreditExpense(), { wrapper });
    const body = {
      name: "Hook criada",
      totalAmount: "99.90",
      occurredAt: "2031-02-01T15:00:00Z",
      recurrencyDay: 3,
      status: "Once" as const,
      accountId: (await account()).id,
    };
    await act(() => result.current.mutateAsync(body));
    expect(requests).toEqual([{ method: "POST", path: "/credit-expenses", body }]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["creditExpenses"] });
  });

  it("update sends PATCH with the partial body and invalidates the list", async () => {
    const item = await seed("Hook editada");
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useUpdateCreditExpense(), { wrapper });
    await act(() => result.current.mutateAsync({ id: item.id, input: { status: "ToCancel" } }));
    expect(requests).toEqual([
      { method: "PATCH", path: `/credit-expenses/${item.id}`, body: { status: "ToCancel" } },
    ]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["creditExpenses"] });
  });

  it("delete calls DELETE /credit-expenses/:id and invalidates the list", async () => {
    const item = await seed("Hook excluída");
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useDeleteCreditExpense(), { wrapper });
    await act(() => result.current.mutateAsync(item.id));
    expect(requests).toEqual([
      { method: "DELETE", path: `/credit-expenses/${item.id}`, body: undefined },
    ]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["creditExpenses"] });
  });
});

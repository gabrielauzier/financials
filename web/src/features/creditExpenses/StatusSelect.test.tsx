import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { mockRequest } from "@/lib/api/mock";
import type { Account, CreditExpense, CreditExpenseStatus } from "@/lib/api/types";
import { failures, renderWithQuery, requests, resetSpy } from "@/test/apiSpy";
import { useCreditExpenses } from "./hooks";
import { creditExpenseStatuses, creditExpenseStatusLabels } from "./labels";
import { StatusSelect } from "./StatusSelect";

// PATCH requests wait for the gate while it is set, so the optimistic state can be observed.
const gate = vi.hoisted(() => ({ promise: undefined as Promise<void> | undefined }));
vi.mock("@/lib/api/client", async (importOriginal) => {
  const spy = await import("@/test/apiSpy");
  return {
    ...(await importOriginal<typeof import("@/lib/api/client")>()),
    apiRequest: async (path: string, options: { method?: string; body?: unknown } = {}) => {
      if (options.method?.toUpperCase() === "PATCH") await gate.promise;
      return spy.spiedApiRequest(path, options);
    },
  };
});

afterEach(() => {
  cleanup();
  resetSpy();
  gate.promise = undefined;
});

const patches = () => requests.filter((request) => request.method === "PATCH");
const seed = async (name: string, status: CreditExpenseStatus) => {
  const account = (
    await mockRequest<Account[]>({ method: "GET", path: "/accounts?active=true" })
  )[0] as Account;
  return mockRequest<CreditExpense>({
    method: "POST",
    path: "/credit-expenses",
    body: {
      name,
      totalAmount: "600.00",
      paidAmount: "200.00",
      occurredAt: "2031-01-20T15:00:00Z",
      recurrencyDay: 7,
      status,
      accountId: account.id,
    },
  });
};
const triggerOf = (name: string) => screen.findByRole("combobox", { name: `Status de ${name}` });

/** Renders the list from the query cache so cache updates (optimistic or rolled back) show. */
function Harness({ name }: { name: string }) {
  const { data = [] } = useCreditExpenses({});
  return (
    <>
      {data
        .filter((item) => item.name === name)
        .map((item) => (
          <div key={item.id}>
            <StatusSelect expense={item} />
            <span data-testid="paid">{item.paidAmount}</span>
          </div>
        ))}
    </>
  );
}

describe("StatusSelect", () => {
  it.each(creditExpenseStatuses)(
    "offers all 5 statuses when the current one is %s",
    async (current) => {
      const item = await seed(`Opções ${current}`, current);
      renderWithQuery(<StatusSelect expense={item} />);
      const trigger = await triggerOf(item.name);
      expect(trigger).toHaveTextContent(creditExpenseStatusLabels[current]);
      fireEvent.click(trigger);
      expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual(
        creditExpenseStatuses.map((status) => creditExpenseStatusLabels[status]),
      );
    },
  );

  it("saves the chosen status immediately with a status-only PATCH and keeps the paid amount", async () => {
    const item = await seed("Salva status", "Active");
    renderWithQuery(<Harness name={item.name} />);
    fireEvent.click(await triggerOf(item.name));
    fireEvent.click(await screen.findByRole("option", { name: "A cancelar" }));
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]).toEqual({
      method: "PATCH",
      path: `/credit-expenses/${item.id}`,
      body: { status: "ToCancel" },
    });
    await waitFor(async () => expect(await triggerOf(item.name)).toHaveTextContent("A cancelar"));
    expect(screen.getByTestId("paid")).toHaveTextContent("200.00");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the new status optimistically while the PATCH is still pending", async () => {
    const item = await seed("Otimista", "Active");
    let release = () => {};
    gate.promise = new Promise<void>((resolve) => (release = resolve));
    renderWithQuery(<Harness name={item.name} />);
    fireEvent.click(await triggerOf(item.name));
    fireEvent.click(await screen.findByRole("option", { name: "Cancelada" }));
    await waitFor(async () => expect(await triggerOf(item.name)).toHaveTextContent("Cancelada"));
    release();
    await waitFor(() => expect(requests.filter((r) => r.method === "GET")).toHaveLength(2));
    expect(await triggerOf(item.name)).toHaveTextContent("Cancelada");
  });

  it("restores the previous status and shows the Portuguese message when the PATCH and the refetch fail", async () => {
    const item = await seed("Reverte", "Active");
    renderWithQuery(<Harness name={item.name} />);
    expect(await triggerOf(item.name)).toHaveTextContent("Ativa (recorre até quitar)");
    failures.set(
      "PATCH /credit-expenses/:id",
      new ApiError("invalid_status", "Technical English text", 422, "status"),
    );
    failures.set("GET /credit-expenses", new Error("refetch failed"));
    fireEvent.click(await triggerOf(item.name));
    fireEvent.click(await screen.findByRole("option", { name: "Inativa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Status inválido");
    expect(screen.queryByText(/Technical English/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(requests.filter((request) => request.method === "GET")).toHaveLength(2),
    );
    expect(await triggerOf(item.name)).toHaveTextContent("Ativa (recorre até quitar)");
    expect(screen.getByTestId("paid")).toHaveTextContent("200.00");
  });
});

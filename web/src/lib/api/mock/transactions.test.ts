import { describe, expect, it } from "vitest";
import type { Transaction, TransactionInput, TransactionsPage, TransactionUpdate } from "../types";
import { mockRequest } from "./index";

const accountsList = () => mockRequest<{ id: string }[]>({ method: "GET", path: "/accounts" });

async function validInput(over: Record<string, unknown> = {}) {
  const accounts = await accountsList();
  const account = accounts.find((item) => (item as { active?: boolean }).active !== false);
  return {
    name: "Mercado",
    type: "Expense",
    occurredAt: "2026-10-05T15:00:00.000Z",
    amount: "10.00",
    accountId: account?.id ?? "",
    paymentMethod: "PIX",
    ...over,
  } as TransactionInput;
}

const create = async (over: Record<string, unknown> = {}) =>
  mockRequest<Transaction>({ method: "POST", path: "/transactions", body: await validInput(over) });

describe("transactions mock follows the API for description", () => {
  it("returns description (string or null) on every listed transaction, with some seeded", async () => {
    const page = await mockRequest<TransactionsPage>({ method: "GET", path: "/transactions" });
    expect(
      page.items.every((item) => item.description === null || typeof item.description === "string"),
    ).toBe(true);
    expect(
      page.items.some((item) => typeof item.description === "string" && item.description !== ""),
    ).toBe(true);
    expect(page.items.some((item) => item.description === null)).toBe(true);
  });

  it("keeps the trimmed description on create and returns it in the list", async () => {
    const created = await create({ name: "Com texto", description: "  PIX ENVIADO MARIA  " });
    expect(created.description).toBe("PIX ENVIADO MARIA");
    const page = await mockRequest<TransactionsPage>({
      method: "GET",
      path: "/transactions?q=Com%20texto",
    });
    expect(page.items.find((item) => item.id === created.id)?.description).toBe(
      "PIX ENVIADO MARIA",
    );
  });

  it("stores null when the description is omitted, null, empty or only spaces", async () => {
    expect((await create()).description).toBeNull();
    for (const description of [null, "", "   "]) {
      expect((await create({ description })).description).toBeNull();
    }
  });

  it("ignores description on PATCH, also when other fields change in the same body", async () => {
    const created = await create({ description: "Título original" });
    const only = await mockRequest<Transaction>({
      method: "PATCH",
      path: `/transactions/${created.id}`,
      body: { description: "Outro" },
    });
    expect(only.description).toBe("Título original");
    const both = await mockRequest<Transaction>({
      method: "PATCH",
      path: `/transactions/${created.id}`,
      body: { name: "Renomeada", description: null },
    });
    expect(both).toMatchObject({ name: "Renomeada", description: "Título original" });
  });
});

describe("transactions mock generates every payment method", () => {
  it("includes Other among the seeded transactions and accepts it on create", async () => {
    const all = await mockRequest<TransactionsPage>({
      method: "GET",
      path: "/transactions?pageSize=500",
    });
    const seen = new Set<string>();
    for (let page = 1; page <= Math.ceil(all.total / all.pageSize); page += 1) {
      const current = await mockRequest<TransactionsPage>({
        method: "GET",
        path: `/transactions?page=${page}`,
      });
      current.items.forEach((item) => seen.add(item.paymentMethod));
    }
    expect([...seen].sort()).toEqual([
      "BankTransfer",
      "Boleto",
      "Cash",
      "CreditCard",
      "DebitCard",
      "NuPay",
      "Other",
      "PIX",
    ]);
    expect((await create({ paymentMethod: "Other" })).paymentMethod).toBe("Other");
  });
});

/** The seeded rows only (ids with the seed prefix), over every page: rows created by other tests are left out. */
async function seededTransactions(): Promise<Transaction[]> {
  const first = await mockRequest<TransactionsPage>({ method: "GET", path: "/transactions" });
  const rows = [...first.items];
  for (let page = 2; page <= Math.ceil(first.total / first.pageSize); page += 1) {
    const next = await mockRequest<TransactionsPage>({
      method: "GET",
      path: `/transactions?page=${page}`,
    });
    rows.push(...next.items);
  }
  return rows.filter((item) => item.id.startsWith("40000000-0000-4000-8000-"));
}

describe("transactions mock follows the API for identifier (read-only)", () => {
  it("returns identifier (string or null) on every seeded transaction, some filled and some null", async () => {
    const seeded = await seededTransactions();
    expect(seeded).toHaveLength(120);
    expect(
      seeded.every((item) => item.identifier === null || typeof item.identifier === "string"),
    ).toBe(true);
    expect(seeded.some((item) => item.identifier !== null && item.identifier !== "")).toBe(true);
    expect(seeded.some((item) => item.identifier === null)).toBe(true);
  });

  it("creates with identifier null even when the body sends one, and lists it as null", async () => {
    const created = await create({ name: "Com id enviado", identifier: "ID-ENVIADO" });
    expect(created.identifier).toBeNull();
    const page = await mockRequest<TransactionsPage>({
      method: "GET",
      path: "/transactions?q=Com%20id%20enviado",
    });
    expect(page.items.find((item) => item.id === created.id)?.identifier).toBeNull();
  });

  it("ignores identifier on PATCH, also when other fields change in the same body", async () => {
    const imported = (await seededTransactions()).find(
      (item) => item.identifier !== null,
    ) as Transaction;
    const only = await mockRequest<Transaction>({
      method: "PATCH",
      path: `/transactions/${imported.id}`,
      body: { identifier: "OUTRO" },
    });
    expect(only.identifier).toBe(imported.identifier);
    const both = await mockRequest<Transaction>({
      method: "PATCH",
      path: `/transactions/${imported.id}`,
      body: { name: "Renomeada id", identifier: null },
    });
    expect(both).toMatchObject({ name: "Renomeada id", identifier: imported.identifier });
  });

  it("does not let TransactionInput or TransactionUpdate carry identifier (compile-time)", () => {
    const input: TransactionInput = {
      name: "x",
      type: "Expense",
      occurredAt: "2026-10-05T15:00:00.000Z",
      amount: "1.00",
      accountId: "a",
      paymentMethod: "PIX",
      // @ts-expect-error identifier is read-only: not part of the input type
      identifier: "x",
    };
    // @ts-expect-error identifier is read-only: not part of the update type
    const update: TransactionUpdate = { identifier: "x" };
    expect([input, update]).toHaveLength(2);
  });
});

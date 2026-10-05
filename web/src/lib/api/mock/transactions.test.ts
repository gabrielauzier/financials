import { describe, expect, it } from "vitest";
import type { Transaction, TransactionInput, TransactionsPage } from "../types";
import { mockRequest } from "./index";

const accountsList = () =>
  mockRequest<{ id: string }[]>({ method: "GET", path: "/accounts" });

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
    expect(page.items.every((item) => item.description === null || typeof item.description === "string")).toBe(true);
    expect(page.items.some((item) => typeof item.description === "string" && item.description !== "")).toBe(true);
    expect(page.items.some((item) => item.description === null)).toBe(true);
  });

  it("keeps the trimmed description on create and returns it in the list", async () => {
    const created = await create({ name: "Com texto", description: "  PIX ENVIADO MARIA  " });
    expect(created.description).toBe("PIX ENVIADO MARIA");
    const page = await mockRequest<TransactionsPage>({ method: "GET", path: "/transactions?q=Com%20texto" });
    expect(page.items.find((item) => item.id === created.id)?.description).toBe("PIX ENVIADO MARIA");
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

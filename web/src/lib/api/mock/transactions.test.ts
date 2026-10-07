import { beforeAll, describe, expect, it } from "vitest";
import type {
  Category,
  Transaction,
  TransactionFilters,
  TransactionInput,
  TransactionsPage,
  TransactionSummary,
  TransactionUpdate,
} from "../types";
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
      path: "/transactions",
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

describe("transactions mock follows the API for pageSize", () => {
  const list = (query: string) =>
    mockRequest<TransactionsPage>({ method: "GET", path: `/transactions${query}` });

  it("returns up to 50 rows and pageSize 50 by default", async () => {
    const page = await list("");
    expect(page.pageSize).toBe(50);
    expect(page.items).toHaveLength(50);
  });

  it.each([25, 50, 100] as const)(
    "returns up to %i rows and echoes that pageSize",
    async (size) => {
      const page = await list(`?pageSize=${size}`);
      expect(page.pageSize).toBe(size);
      expect(page.items).toHaveLength(size);
      expect(page.total).toBeGreaterThanOrEqual(120);
    },
  );

  it("pages by the chosen size: the second page of 25 continues the first", async () => {
    const [first, second, wide] = await Promise.all([
      list("?pageSize=25&page=1"),
      list("?pageSize=25&page=2"),
      list("?pageSize=50&page=1"),
    ]);
    expect([...first.items, ...second.items].map((item) => item.id)).toEqual(
      wide.items.map((item) => item.id),
    );
  });

  it.each(["30", "0", "101", "", "050"])(
    "rejects pageSize=%j with 422 validation_error on pageSize",
    async (value) => {
      await expect(list(`?pageSize=${value}`)).rejects.toMatchObject({
        code: "validation_error",
        status: 422,
        field: "pageSize",
      });
    },
  );

  it("types pageSize as 25, 50 or 100 only (compile-time)", () => {
    const valid: TransactionFilters[] = [{ pageSize: 25 }, { pageSize: 50 }, { pageSize: 100 }];
    // @ts-expect-error 30 is not an accepted page size
    const invalid: TransactionFilters = { pageSize: 30 };
    const summary: TransactionSummary = {
      count: 0,
      income: "0.00",
      expense: "0.00",
      investments: "0.00",
      balance: "0.00",
    };
    expect([valid, invalid, summary]).toHaveLength(3);
  });
});

describe("transactions mock summary follows the API rules", () => {
  const PREFIX = "Resumo mock";
  const summary = (query = "") =>
    mockRequest<TransactionSummary>({
      method: "GET",
      path: `/transactions/summary?q=${encodeURIComponent(PREFIX)}${query}`,
    });
  const categoryId = async (key: string) =>
    (await mockRequest<Category[]>({ method: "GET", path: "/categories" })).find(
      (item) => item.key === key,
    )?.id as string;

  const FUTURE = "2099-01-10T12:00:00.000Z";
  beforeAll(async () => {
    const [salaries, food, investments, reversal] = await Promise.all(
      ["Salaries", "Food", "Investments", "Reversal"].map(categoryId),
    );
    const rows: Array<Record<string, unknown>> = [
      { type: "Income", amount: "1000.00", categoryId: salaries },
      { type: "Expense", amount: "100.00", categoryId: food },
      { type: "Expense", amount: "1.10", categoryId: food },
      { type: "Expense", amount: "2.20", categoryId: food },
      { type: "Expense", amount: "1.00", categoryId: food, neutral: true },
      { type: "Expense", amount: "3.00", categoryId: food, paymentMethod: "CreditCard" },
      { type: "Expense", amount: "200.00", categoryId: investments },
      { type: "Income", amount: "5.00", categoryId: investments },
      { type: "Income", amount: "30.00", categoryId: reversal },
      { type: "Expense", amount: "20.00", categoryId: reversal },
      { type: "Expense", amount: "6.00", categoryId: food, occurredAt: FUTURE },
      { type: "Income", amount: "7.00", categoryId: salaries, occurredAt: FUTURE },
    ];
    for (const row of rows) await create({ name: `${PREFIX} ${row["amount"]}`, ...row });
  });

  it("applies the rules to a row of each special case with exact 2-decimal strings", async () => {
    // income 1000; expense 100 + 1.10 + 2.20 (3.30, not 3.3000000000000003) + 20 - 30 = 93.30
    expect(await summary()).toEqual({
      count: 12,
      income: "1000.00",
      expense: "93.30",
      investments: "195.00",
      balance: "906.70",
    });
  });

  it("applies the list filters: a type filter leaves the Reversal Income out of the expense", async () => {
    expect(await summary("&type=Expense")).toEqual({
      count: 8,
      income: "0.00",
      expense: "123.30",
      investments: "200.00",
      balance: "-123.30",
    });
    expect(await summary(`&categoryId=${await categoryId("Investments")}`)).toEqual({
      count: 2,
      income: "0.00",
      expense: "0.00",
      investments: "195.00",
      balance: "0.00",
    });
  });

  it("applies the neutral filter to the list and to the summary (the neutral row is out of every total)", async () => {
    const list = (neutral: string) =>
      mockRequest<{ items: Array<{ neutral: boolean }>; total: number }>({
        method: "GET",
        path: `/transactions?q=${encodeURIComponent(PREFIX)}&neutral=${neutral}`,
      });
    const onlyNeutral = await list("true");
    expect(onlyNeutral.total).toBe(1);
    expect(onlyNeutral.items.every((item) => item.neutral)).toBe(true);
    const notNeutral = await list("false");
    expect(notNeutral.total).toBe(11);
    expect(notNeutral.items.some((item) => item.neutral)).toBe(false);
    expect(await summary("&neutral=true")).toEqual({
      count: 1,
      income: "0.00",
      expense: "0.00",
      investments: "0.00",
      balance: "0.00",
    });
    expect(await summary("&neutral=false")).toMatchObject({ count: 11, expense: "93.30" });
  });

  it("ignores sort, order, page and pageSize, even an invalid pageSize", async () => {
    const plain = await summary();
    expect(await summary("&sort=amount&order=asc&page=9&pageSize=25")).toEqual(plain);
    expect(await summary("&pageSize=30")).toEqual(plain);
  });

  it("answers the zeros and count 0 when nothing matches", async () => {
    expect(
      await mockRequest<TransactionSummary>({
        method: "GET",
        path: "/transactions/summary?q=ninguem-tem-este-nome",
      }),
    ).toEqual({ count: 0, income: "0.00", expense: "0.00", investments: "0.00", balance: "0.00" });
  });

  it("keeps whole and one-decimal amounts exact (10 + 10.5 = 20.50)", async () => {
    await create({ name: "Fracao mock inteiro", amount: "10" });
    await create({ name: "Fracao mock meio", amount: "10.5" });
    expect(
      await mockRequest<TransactionSummary>({
        method: "GET",
        path: "/transactions/summary?q=Fracao%20mock",
      }),
    ).toEqual({
      count: 2,
      income: "0.00",
      expense: "20.50",
      investments: "0.00",
      balance: "-20.50",
    });
  });
});

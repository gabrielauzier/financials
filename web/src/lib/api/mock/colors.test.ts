import { describe, expect, it } from "vitest";
import type { Account, Category } from "../types";
import { mockRequest } from "./index";

// The design table "Tabela de cores semeadas".
const SEEDED_COLORS: Record<string, string> = {
  Entertainment: "purple-400",
  Food: "orange-400",
  Salaries: "emerald-400",
  Healthcare: "rose-400",
  Utilities: "sky-400",
  Unknown: "zinc-400",
  Transport: "blue-400",
  Help: "pink-400",
  PJ: "indigo-400",
  Bills: "amber-400",
  Emergency: "red-400",
  Uncategorized: "slate-400",
  Wishes: "fuchsia-400",
  Reversal: "teal-400",
  Shopping: "lime-400",
  Pets: "yellow-400",
  Investments: "green-400",
};

const accounts = () => mockRequest<Account[]>({ method: "GET", path: "/accounts" });
const categories = () => mockRequest<Category[]>({ method: "GET", path: "/categories" });
const input = (nickname: string) => ({ bank: "XP", nickname, holderNames: ["Titular"] });
const colorError = { code: "validation_error", status: 422, field: "color" };

describe("mock seeds", () => {
  it("seeds the 17 categories with the design colors, all distinct", async () => {
    const list = await categories();
    expect(list).toHaveLength(17);
    expect(Object.fromEntries(list.map((item) => [item.key, item.color]))).toEqual(SEEDED_COLORS);
    expect(new Set(list.map((item) => item.color)).size).toBe(17);
  });

  it("seeds the two accounts with the Nubank color and returns color on every item", async () => {
    const list = await accounts();
    expect(list).toHaveLength(2);
    expect(list.map((item) => item.color)).toEqual(["purple-400", "purple-400"]);
    const active = await mockRequest<Account[]>({ method: "GET", path: "/accounts?active=true" });
    expect(active.every((item) => typeof item.color === "string")).toBe(true);
  });
});

describe("accounts mock", () => {
  it("stores and returns a valid color on POST and PATCH, defaulting to slate-400", async () => {
    const created = await mockRequest<Account>({
      method: "POST",
      path: "/accounts",
      body: { ...input("Com cor"), color: "teal-400" },
    });
    expect(created.color).toBe("teal-400");
    const plain = await mockRequest<Account>({
      method: "POST",
      path: "/accounts",
      body: input("Sem cor"),
    });
    expect(plain.color).toBe("slate-400");

    const patched = await mockRequest<Account>({
      method: "PATCH",
      path: `/accounts/${plain.id}`,
      body: { color: "rose-400" },
    });
    expect(patched).toMatchObject({ color: "rose-400", nickname: "Sem cor", bank: "XP" });
    expect((await accounts()).find((item) => item.id === plain.id)?.color).toBe("rose-400");
  });

  it.each(["", "blue-500", "Blue-400", "blue-600"])(
    "rejects the color %j with a 422 validation_error on field color",
    async (color) => {
      await expect(
        mockRequest({
          method: "POST",
          path: "/accounts",
          body: { ...input(`Inválida ${color}`), color },
        }),
      ).rejects.toMatchObject(colorError);
      const [first] = await accounts();
      await expect(
        mockRequest({ method: "PATCH", path: `/accounts/${first?.id}`, body: { color } }),
      ).rejects.toMatchObject(colorError);
      expect((await accounts())[0]?.color).toBe("purple-400");
    },
  );
});

describe("categories mock", () => {
  it("stores and returns a valid color on POST, defaulting to slate-400", async () => {
    const chosen = await mockRequest<Category>({
      method: "POST",
      path: "/categories",
      body: { name: "Viagens", color: "rose-400" },
    });
    expect(chosen).toMatchObject({ name: "Viagens", color: "rose-400", isSystem: false });
    const plain = await mockRequest<Category>({
      method: "POST",
      path: "/categories",
      body: { name: "Sem cor" },
    });
    expect(plain.color).toBe("slate-400");
  });

  it("PATCH with name and color updates both; with only color keeps the name", async () => {
    const pets = (await categories()).find((item) => item.key === "Pets");
    const both = await mockRequest<Category>({
      method: "PATCH",
      path: `/categories/${pets?.id}`,
      body: { name: "Bichos", color: "stone-400" },
    });
    expect(both).toMatchObject({ name: "Bichos", color: "stone-400" });
    const onlyColor = await mockRequest<Category>({
      method: "PATCH",
      path: `/categories/${pets?.id}`,
      body: { color: "cyan-400" },
    });
    expect(onlyColor).toMatchObject({ name: "Bichos", color: "cyan-400" });
    expect((await categories()).find((item) => item.id === pets?.id)).toMatchObject({
      name: "Bichos",
      color: "cyan-400",
    });
  });

  it.each(["", "blue-500", "Blue-400", "blue-600"])(
    "rejects the color %j with a 422 validation_error on field color",
    async (color) => {
      await expect(
        mockRequest({
          method: "POST",
          path: "/categories",
          body: { name: `Inválida ${color}`, color },
        }),
      ).rejects.toMatchObject(colorError);
      const food = (await categories()).find((item) => item.key === "Food");
      await expect(
        mockRequest({ method: "PATCH", path: `/categories/${food?.id}`, body: { color } }),
      ).rejects.toMatchObject(colorError);
      expect((await categories()).find((item) => item.key === "Food")?.color).toBe("orange-400");
    },
  );

  it("still throws category_protected when a system category is patched", async () => {
    const system = (await categories()).find((item) => item.key === "Uncategorized");
    await expect(
      mockRequest({
        method: "PATCH",
        path: `/categories/${system?.id}`,
        body: { name: "X", color: "red-400" },
      }),
    ).rejects.toMatchObject({ code: "category_protected", status: 403 });
    expect((await categories()).find((item) => item.key === "Uncategorized")?.color).toBe(
      "slate-400",
    );
  });
});

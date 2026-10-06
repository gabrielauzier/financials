import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/lib/api/client", () => ({ apiRequest }));

import { createAccount, updateAccount } from "@/features/accounts/api";
import { createCategory, updateCategory } from "@/features/categories/api";

beforeEach(() => apiRequest.mockClear());

describe("clients send color", () => {
  it("createCategory sends name and color in the POST body", async () => {
    await createCategory({ name: "Viagens", color: "rose-400" });
    expect(apiRequest).toHaveBeenCalledWith("/categories", {
      method: "POST",
      body: { name: "Viagens", color: "rose-400" },
    });
  });

  it("createCategory without color sends only the name", async () => {
    await createCategory({ name: "Viagens" });
    expect(apiRequest).toHaveBeenCalledWith("/categories", {
      method: "POST",
      body: { name: "Viagens" },
    });
  });

  it("updateCategory sends name and color without the id in the PATCH body", async () => {
    await updateCategory({ id: "abc", name: "Bichos", color: "teal-400" });
    expect(apiRequest).toHaveBeenCalledWith("/categories/abc", {
      method: "PATCH",
      body: { name: "Bichos", color: "teal-400" },
    });
    apiRequest.mockClear();
    await updateCategory({ id: "abc", color: "red-400" });
    expect(apiRequest).toHaveBeenCalledWith("/categories/abc", {
      method: "PATCH",
      body: { color: "red-400" },
    });
  });

  it("createAccount and updateAccount send color in the body", async () => {
    await createAccount({ bank: "Neon", nickname: "Neon", holderNames: ["A"], color: "sky-400" });
    expect(apiRequest).toHaveBeenCalledWith("/accounts", {
      method: "POST",
      body: { bank: "Neon", nickname: "Neon", holderNames: ["A"], color: "sky-400" },
    });
    apiRequest.mockClear();
    await updateAccount({ id: "xyz", input: { color: "lime-400" } });
    expect(apiRequest).toHaveBeenCalledWith("/accounts/xyz", {
      method: "PATCH",
      body: { color: "lime-400" },
    });
  });
});

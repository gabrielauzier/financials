import { describe, expect, it, vi } from "vitest";
import { formatBRL, formatDateLocal } from "./format";

describe("formatadores", () => {
  it("formata moeda sem converter o valor em number", () => {
    expect(formatBRL("1234.56")).toBe("R$ 1.234,56");
    expect(formatBRL("-12")).toBe("-R$ 12,00");
    expect(formatBRL("900719925474099312345.99")).toBe("R$ 900.719.925.474.099.312.345,99");
  });
  it("formata a data no fuso local", () => {
    vi.stubEnv("TZ", "UTC");
    expect(formatDateLocal("2026-10-05T12:00:00Z")).toBe("05/10/2026");
  });
});

import { describe, expect, it } from "vitest";
import { parseSignedBRLToDecimal } from "./money";

describe("parseSignedBRLToDecimal", () => {
  it.each([
    ["-1.234,56", "-1234.56"],
    ["1.234,56", "1234.56"],
    ["+50", "50.00"],
    ["12,5", "12.50"],
    ["-0,01", "-0.01"],
    ["  -20  ", "-20.00"],
    ["1.000.000,00", "1000000.00"],
  ])("converts %s to %s", (input, expected) => {
    expect(parseSignedBRLToDecimal(input)).toBe(expected);
  });

  it.each([
    "",
    " ",
    "-",
    "0",
    "0,00",
    "-0,00",
    "+0",
    "1,234",
    "10,123",
    "abc",
    "--5",
    "1.23",
    "5,",
  ])("rejects %j (blank, zero, more than 2 decimals or malformed)", (input) => {
    expect(parseSignedBRLToDecimal(input)).toBeNull();
  });

  it("keeps precision beyond float range", () => {
    expect(parseSignedBRLToDecimal("-99.999.999.999.999,99")).toBe("-99999999999999.99");
  });
});

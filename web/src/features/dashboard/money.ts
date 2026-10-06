import { parseBRLToDecimal } from "@/features/transactions/utils";

/**
 * Brazilian input ("-1.234,56", "+50", "12,5") to a signed decimal string with 2 decimals
 * ("-1234.56"), without floats. Null for blank, zero, more than 2 decimals or malformed text.
 */
export function parseSignedBRLToDecimal(value: string): string | null {
  const clean = value.trim().replace(/\s/g, "");
  const negative = clean.startsWith("-");
  const magnitude = parseBRLToDecimal(clean.replace(/^[+-]/, ""));
  if (magnitude === null) return null;
  const [integer = "0", fraction = ""] = magnitude.split(".");
  return `${negative ? "-" : ""}${integer}.${fraction.padEnd(2, "0")}`;
}

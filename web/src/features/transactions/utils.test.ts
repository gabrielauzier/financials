import { afterEach, describe, expect, it, vi } from "vitest";
import { amountClassName, formatSignedAmount, todayLocal } from "./utils";

const originalTZ = process.env["TZ"];
afterEach(() => {
  vi.useRealTimers();
  if (originalTZ === undefined) delete process.env["TZ"];
  else process.env["TZ"] = originalTZ;
});

describe("todayLocal", () => {
  it("às 23:30 em America/Sao_Paulo ainda devolve o dia local, não o dia seguinte de UTC", () => {
    process.env["TZ"] = "America/Sao_Paulo";
    // 2026-10-06T02:30Z is still the 5th in São Paulo (UTC-3)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T02:30:00Z"));
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-10-06");
    expect(todayLocal()).toBe("2026-10-05");
  });

  it("à meia-noite local passa para o dia seguinte e não antes", () => {
    process.env["TZ"] = "America/Sao_Paulo";
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 5, 23, 59, 59));
    expect(todayLocal()).toBe("2026-10-05");
    vi.setSystemTime(new Date(2026, 9, 6, 0, 0, 0));
    expect(todayLocal()).toBe("2026-10-06");
  });

  it("vira o mês e o ano nas bordas locais e preenche zeros", () => {
    process.env["TZ"] = "America/Sao_Paulo";
    expect(todayLocal(new Date(2026, 11, 31, 23, 59, 59))).toBe("2026-12-31");
    expect(todayLocal(new Date(2027, 0, 1, 0, 0, 0))).toBe("2027-01-01");
    expect(todayLocal(new Date(2028, 1, 29, 12))).toBe("2028-02-29");
    expect(todayLocal(new Date(2026, 2, 9, 8))).toBe("2026-03-09");
  });

  it("a leste de UTC (Pacific/Kiritimati, UTC+14) também devolve o dia local", () => {
    process.env["TZ"] = "Pacific/Kiritimati";
    // 2026-10-05T12:00Z is already the 6th at 02:00 locally
    expect(todayLocal(new Date("2026-10-05T12:00:00Z"))).toBe("2026-10-06");
  });
});

describe("amountClassName (IMPIMP-05)", () => {
  it("receita fica em verde com as classes do extrato", () => {
    const classes = amountClassName("Income").split(" ");
    expect(classes).toEqual(
      expect.arrayContaining([
        "text-emerald-700",
        "dark:text-emerald-400",
        "font-semibold",
        "whitespace-nowrap",
      ]),
    );
    expect(classes).not.toContain("text-destructive");
  });

  it("despesa fica em vermelho com as classes do extrato", () => {
    const classes = amountClassName("Expense").split(" ");
    expect(classes).toEqual(
      expect.arrayContaining(["text-destructive", "font-semibold", "whitespace-nowrap"]),
    );
    expect(classes).not.toContain("text-emerald-700");
  });
});

describe("formatSignedAmount (IMPIMP-05)", () => {
  it("receita não tem sinal", () => {
    expect(formatSignedAmount("Income", "1234.56")).toBe("R$ 1.234,56");
  });

  it("despesa tem um único sinal, com ou sem sinal no valor recebido", () => {
    expect(formatSignedAmount("Expense", "1234.56")).toBe("-R$ 1.234,56");
    expect(formatSignedAmount("Expense", "-1234.56")).toBe("-R$ 1.234,56");
  });

  it("formata zero e valores grandes", () => {
    expect(formatSignedAmount("Expense", "0.00")).toBe("-R$ 0,00");
    expect(formatSignedAmount("Income", "0.00")).toBe("R$ 0,00");
    expect(formatSignedAmount("Income", "1234567.89")).toBe("R$ 1.234.567,89");
    expect(formatSignedAmount("Expense", "-1234567.89")).toBe("-R$ 1.234.567,89");
  });
});

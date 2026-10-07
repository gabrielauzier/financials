import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateLocal } from "@/lib/format";
import {
  amountClassName,
  formatSignedAmount,
  summaryFilters,
  todayLocal,
  weekdayAbbrev,
} from "./utils";

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

describe("weekdayAbbrev (TUXV2-12)", () => {
  const setZone = (zone: string) => {
    process.env["TZ"] = zone;
  };
  // local noon of a civil day, so the day is the same in every zone the tests use
  const noon = (year: number, month: number, day: number) =>
    new Date(year, month - 1, day, 12).toISOString();
  // local 23:30 of a civil day: in America/Sao_Paulo (UTC-3) the UTC day is already the next one
  const lateEvening = (year: number, month: number, day: number) =>
    new Date(year, month - 1, day, 23, 30).toISOString();

  it.each([
    [4, "Dom"],
    [5, "Seg"],
    [6, "Ter"],
    [7, "Qua"],
    [8, "Qui"],
    [9, "Sex"],
    [10, "Sáb"],
  ])("2026-10-%i é %s, com a abreviação e o acento do pedido", (day, expected) => {
    setZone("America/Sao_Paulo");
    expect(weekdayAbbrev(noon(2026, 10, day))).toBe(expected);
  });

  it("às 23:30 locais em America/Sao_Paulo (já dia 6 em UTC) devolve o dia local, igual à data exibida", () => {
    setZone("America/Sao_Paulo");
    const iso = "2026-10-06T02:30:00Z";
    expect(formatDateLocal(iso)).toBe("05/10/2026");
    expect(weekdayAbbrev(iso)).toBe("Seg");
    expect(weekdayAbbrev(lateEvening(2026, 10, 5))).toBe("Seg");
  });

  it("o mesmo instante com o fuso em UTC devolve o dia UTC", () => {
    setZone("UTC");
    const iso = "2026-10-06T02:30:00Z";
    expect(formatDateLocal(iso)).toBe("06/10/2026");
    expect(weekdayAbbrev(iso)).toBe("Ter");
  });

  it("a leste de UTC (Pacific/Kiritimati) usa o dia local, que já é o seguinte", () => {
    setZone("Pacific/Kiritimati");
    // 2026-10-05T12:00Z is the 6th at 02:00 locally
    expect(weekdayAbbrev("2026-10-05T12:00:00Z")).toBe("Ter");
  });

  it("meia-noite UTC em America/Sao_Paulo é a noite do dia local anterior: 2026-03-01T00:00Z mostra 28/02 e Sáb", () => {
    setZone("America/Sao_Paulo");
    expect(formatDateLocal("2026-03-01T00:00:00Z")).toBe("28/02/2026");
    expect(weekdayAbbrev("2026-03-01T00:00:00Z")).toBe("Sáb");
    setZone("UTC");
    expect(weekdayAbbrev("2026-03-01T00:00:00Z")).toBe("Dom");
  });

  it("vira o mês: 28/02/2026 é Sáb e 01/03/2026 é Dom, também às 23:30 locais", () => {
    setZone("America/Sao_Paulo");
    expect(weekdayAbbrev(noon(2026, 2, 28))).toBe("Sáb");
    expect(weekdayAbbrev(lateEvening(2026, 2, 28))).toBe("Sáb");
    expect(weekdayAbbrev(noon(2026, 3, 1))).toBe("Dom");
  });

  it("vira o ano: 31/12/2026 é Qui e 01/01/2027 é Sex, também às 23:30 locais", () => {
    setZone("America/Sao_Paulo");
    expect(weekdayAbbrev(noon(2026, 12, 31))).toBe("Qui");
    expect(weekdayAbbrev(lateEvening(2026, 12, 31))).toBe("Qui");
    expect(weekdayAbbrev(noon(2027, 1, 1))).toBe("Sex");
  });

  it("ano bissexto: 29/02/2028 é Ter e 01/03/2028 é Qua; em ano comum 28/02/2027 é Dom e 01/03/2027 é Seg", () => {
    setZone("America/Sao_Paulo");
    expect(weekdayAbbrev(noon(2028, 2, 29))).toBe("Ter");
    expect(weekdayAbbrev(lateEvening(2028, 2, 29))).toBe("Ter");
    expect(weekdayAbbrev(noon(2028, 3, 1))).toBe("Qua");
    expect(weekdayAbbrev(noon(2027, 2, 28))).toBe("Dom");
    expect(weekdayAbbrev(noon(2027, 3, 1))).toBe("Seg");
  });

  it("um instante inválido devolve texto vazio", () => {
    setZone("America/Sao_Paulo");
    expect(weekdayAbbrev("não é data")).toBe("");
    expect(weekdayAbbrev("")).toBe("");
  });
});

describe("summaryFilters", () => {
  const ACTIVE = {
    from: "2026-06-01",
    to: "2026-06-30",
    accountId: "a",
    categoryId: "c",
    type: "Expense",
    neutral: false,
    q: "farm",
  } as const;

  it("tira sort, order, page e pageSize e mantém os sete filtros", () => {
    expect(
      summaryFilters({ ...ACTIVE, sort: "amount", order: "asc", page: 3, pageSize: 25 }),
    ).toEqual(ACTIVE);
  });

  it("devolve o mesmo conteúdo para qualquer página, ordenação ou tamanho", () => {
    const base = summaryFilters({ ...ACTIVE, sort: "date", order: "desc", page: 1 });
    expect(
      summaryFilters({ ...ACTIVE, sort: "name", order: "asc", page: 9, pageSize: 100 }),
    ).toEqual(base);
  });

  it("sem filtro ativo devolve um objeto vazio", () => {
    expect(summaryFilters({ sort: "date", order: "desc", page: 1 })).toEqual({});
  });

  it("não altera o objeto recebido", () => {
    const input = { ...ACTIVE, sort: "date", order: "desc", page: 2, pageSize: 25 } as const;
    summaryFilters(input);
    expect(input).toMatchObject({ sort: "date", order: "desc", page: 2, pageSize: 25 });
  });
});

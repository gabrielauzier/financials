import { describe, expect, it } from "vitest";
import { pageNumbers } from "./pagination";

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

describe("pageNumbers: até 7 páginas mostram todas", () => {
  it("com 1 página devolve [1]", () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
  });

  it("com 2 páginas devolve [1, 2] em qualquer página atual", () => {
    expect(pageNumbers(1, 2)).toEqual([1, 2]);
    expect(pageNumbers(2, 2)).toEqual([1, 2]);
  });

  it("com 7 páginas devolve de 1 a 7 na primeira, numa do meio e na última", () => {
    for (const current of [1, 4, 7]) expect(pageNumbers(current, 7)).toEqual(range(1, 7));
  });
});

describe("pageNumbers: 8 páginas (a fronteira entre os ramos)", () => {
  it("da página 1 a 4 devolve 1 2 3 4 5 … 8", () => {
    for (const current of [1, 2, 3, 4]) {
      expect(pageNumbers(current, 8), `atual ${current}`).toEqual([1, 2, 3, 4, 5, "…", 8]);
    }
  });

  it("da página 5 a 8 devolve 1 … 4 5 6 7 8", () => {
    for (const current of [5, 6, 7, 8]) {
      expect(pageNumbers(current, 8), `atual ${current}`).toEqual([1, "…", 4, 5, 6, 7, 8]);
    }
  });
});

describe("pageNumbers: 100 páginas", () => {
  it("nas pontas e perto delas mantém a corrida de 5 páginas", () => {
    expect(pageNumbers(1, 100)).toEqual([1, 2, 3, 4, 5, "…", 100]);
    expect(pageNumbers(4, 100)).toEqual([1, 2, 3, 4, 5, "…", 100]);
    expect(pageNumbers(97, 100)).toEqual([1, "…", 96, 97, 98, 99, 100]);
    expect(pageNumbers(100, 100)).toEqual([1, "…", 96, 97, 98, 99, 100]);
  });

  it("no meio mostra a atual, as vizinhas, a primeira, a última e duas reticências", () => {
    expect(pageNumbers(5, 100)).toEqual([1, "…", 4, 5, 6, "…", 100]);
    expect(pageNumbers(50, 100)).toEqual([1, "…", 49, 50, 51, "…", 100]);
    expect(pageNumbers(96, 100)).toEqual([1, "…", 95, 96, 97, "…", 100]);
  });

  it("para mais de 7 páginas sempre tem 7 entradas, começa em 1 e termina no total", () => {
    for (const total of [8, 9, 20, 100]) {
      for (let current = 1; current <= total; current += 1) {
        const entries = pageNumbers(current, total);
        expect(entries, `${current} de ${total}`).toHaveLength(7);
        expect(entries[0]).toBe(1);
        expect(entries.at(-1)).toBe(total);
        expect(entries, `${current} de ${total}`).toContain(current);
      }
    }
  });
});

describe("pageNumbers: entradas inválidas", () => {
  it("trata total menor que 1 como 1", () => {
    expect(pageNumbers(1, 0)).toEqual([1]);
    expect(pageNumbers(3, -5)).toEqual([1]);
  });

  it("limita a página atual a 1..total", () => {
    expect(pageNumbers(0, 100)).toEqual(pageNumbers(1, 100));
    expect(pageNumbers(-4, 100)).toEqual(pageNumbers(1, 100));
    expect(pageNumbers(250, 100)).toEqual(pageNumbers(100, 100));
    expect(pageNumbers(9, 3)).toEqual([1, 2, 3]);
  });
});

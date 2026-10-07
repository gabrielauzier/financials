import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  PAGE_SIZE_STORAGE_KEY,
  readStoredPageSize,
  usePageSize,
} from "./usePageSize";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("usePageSize: o tamanho guardado", () => {
  it("as opções são exatamente 25, 50 e 100 e o padrão é 50", () => {
    expect(PAGE_SIZES).toEqual([25, 50, 100]);
    expect(DEFAULT_PAGE_SIZE).toBe(50);
  });

  it("sem nada guardado devolve 50", () => {
    expect(renderHook(() => usePageSize()).result.current[0]).toBe(50);
  });

  it.each(["25", "50", "100"])("com %s guardado devolve esse tamanho", (stored) => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, stored);
    expect(renderHook(() => usePageSize()).result.current[0]).toBe(Number(stored));
  });

  it.each(["30", "25 ", " 25", "25.0", "025", "abc", "", "null", '"25"', "[25]"])(
    "um valor guardado inválido (%j) volta para 50",
    (stored) => {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, stored);
      expect(readStoredPageSize()).toBe(50);
      expect(renderHook(() => usePageSize()).result.current[0]).toBe(50);
    },
  );

  it("quando ler o localStorage lança erro devolve 50 sem lançar", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(renderHook(() => usePageSize()).result.current[0]).toBe(50);
  });
});

describe("usePageSize: trocar o tamanho", () => {
  it.each([25, 50, 100] as const)("trocar para %i muda o valor e guarda o texto exato", (size) => {
    const { result } = renderHook(() => usePageSize());
    act(() => result.current[1](size));
    expect(result.current[0]).toBe(size);
    expect(localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe(String(size));
  });

  it("o tamanho escolhido vale na próxima abertura da tela", () => {
    const first = renderHook(() => usePageSize());
    act(() => first.result.current[1](25));
    first.unmount();
    expect(renderHook(() => usePageSize()).result.current[0]).toBe(25);
  });

  it("quando gravar no localStorage lança erro troca o tamanho mesmo assim, sem lançar", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const { result } = renderHook(() => usePageSize());
    expect(() => act(() => result.current[1](100))).not.toThrow();
    expect(result.current[0]).toBe(100);
    expect(localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBeNull();
  });
});

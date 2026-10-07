import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SavedFilterState } from "./savedFilterState";
import { useSavedFilters } from "./useSavedFilters";

const keyOf = (userId: string) => `financials:transactions:saved-filters:${userId}`;
const STATE: SavedFilterState = { type: "Expense", sort: "date", order: "desc" };
const put = (userId: string, names: string[]) =>
  localStorage.setItem(
    keyOf(userId),
    JSON.stringify({
      version: 1,
      filters: names.map((name) => ({ id: `id-${name}`, name, state: STATE })),
    }),
  );
const namesOf = (filters: Array<{ name: string }>) => filters.map((filter) => filter.name);

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("useSavedFilters", () => {
  it("devolve os filtros do usuário em ordem alfabética sem diferenciar caixa e acento", () => {
    put("u1", ["Cebola", "banana", "Água"]);
    const { result } = renderHook(() => useSavedFilters("u1"));
    expect(namesOf(result.current.filters)).toEqual(["Água", "banana", "Cebola"]);
    expect(result.current.available).toBe(true);
  });

  it("atLimit é verdadeiro com 20 filtros e falso com 19", () => {
    put(
      "u1",
      Array.from({ length: 19 }, (_, i) => `F${i}`),
    );
    const { result } = renderHook(() => useSavedFilters("u1"));
    expect(result.current.atLimit).toBe(false);
    let outcome: ReturnType<typeof result.current.add> | undefined;
    act(() => {
      outcome = result.current.add("F19", STATE);
    });
    expect(outcome?.ok).toBe(true);
    expect(result.current.filters).toHaveLength(20);
    expect(result.current.atLimit).toBe(true);
  });

  it("add, rename e remove devolvem o resultado do armazenamento e a lista nova vem na renderização seguinte", () => {
    const { result } = renderHook(() => useSavedFilters("u1"));
    let added: ReturnType<typeof result.current.add> | undefined;
    act(() => {
      added = result.current.add("Zebra", STATE);
    });
    expect(added).toMatchObject({ ok: true, filter: { name: "Zebra", state: STATE } });
    act(() => {
      result.current.add("Abelha", STATE);
    });
    expect(namesOf(result.current.filters)).toEqual(["Abelha", "Zebra"]);
    const zebraId = result.current.filters[1]?.id ?? "";
    let renamed: ReturnType<typeof result.current.rename> | undefined;
    act(() => {
      renamed = result.current.rename(zebraId, "Girafa");
    });
    expect(renamed?.ok).toBe(true);
    expect(namesOf(result.current.filters)).toEqual(["Abelha", "Girafa"]);
    let removed: ReturnType<typeof result.current.remove> | undefined;
    act(() => {
      removed = result.current.remove(zebraId);
    });
    expect(removed?.ok).toBe(true);
    expect(namesOf(result.current.filters)).toEqual(["Abelha"]);
  });

  it("uma falha vem como resultado, sem mexer na lista", () => {
    put("u1", ["Mensal"]);
    const { result } = renderHook(() => useSavedFilters("u1"));
    let outcome: ReturnType<typeof result.current.add> | undefined;
    act(() => {
      outcome = result.current.add("mensal", STATE);
    });
    expect(outcome).toMatchObject({ ok: false, reason: "duplicate-name" });
    expect(namesOf(result.current.filters)).toEqual(["Mensal"]);
  });

  it("depois de not-found a lista é relida e traz o que outra aba gravou", () => {
    put("u1", ["A"]);
    const { result } = renderHook(() => useSavedFilters("u1"));
    expect(namesOf(result.current.filters)).toEqual(["A"]);
    put("u1", ["A", "Da outra aba"]);
    let outcome: ReturnType<typeof result.current.remove> | undefined;
    act(() => {
      outcome = result.current.remove("nao-existe");
    });
    expect(outcome).toMatchObject({ ok: false, reason: "not-found" });
    expect(namesOf(result.current.filters)).toEqual(["A", "Da outra aba"]);
  });

  it("trocar o usuário troca a lista", () => {
    put("A", ["Do A"]);
    put("B", ["Do B"]);
    const { result, rerender } = renderHook(({ id }) => useSavedFilters(id), {
      initialProps: { id: "A" as string | null },
    });
    expect(namesOf(result.current.filters)).toEqual(["Do A"]);
    rerender({ id: "B" });
    expect(namesOf(result.current.filters)).toEqual(["Do B"]);
    // the actions follow the new user too, never the first one
    act(() => {
      result.current.add("Extra do B", STATE);
    });
    act(() => {
      result.current.rename("id-Do B", "Do B renomeado");
    });
    expect(namesOf(result.current.filters)).toEqual(["Do B renomeado", "Extra do B"]);
    act(() => {
      result.current.remove("id-Do B");
    });
    expect(namesOf(result.current.filters)).toEqual(["Extra do B"]);
    rerender({ id: "A" });
    expect(namesOf(result.current.filters)).toEqual(["Do A"]);
  });

  it("sem usuário a lista é vazia, indisponível e as ações falham com storage sem gravar", () => {
    put("A", ["Do A"]);
    const { result } = renderHook(() => useSavedFilters(null));
    expect(result.current.filters).toEqual([]);
    expect(result.current.available).toBe(false);
    let outcome: ReturnType<typeof result.current.add> | undefined;
    act(() => {
      outcome = result.current.add("X", STATE);
    });
    expect(outcome).toMatchObject({ ok: false, reason: "storage" });
    expect(localStorage.length).toBe(1);
  });
});

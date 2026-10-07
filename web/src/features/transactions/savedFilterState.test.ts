import { describe, expect, it } from "vitest";
import {
  describeSavedState,
  isDefaultState,
  sameSavedState,
  sanitizeSavedState,
  toFilterState,
  toSavedState,
  withoutMissingRefs,
  type SavedFilterState,
} from "./savedFilterState";
import type { FilterState } from "./utils";

const FULL: FilterState = {
  filters: {
    q: "farmácia",
    type: "Expense",
    accountId: "acc-1",
    categoryId: "cat-1",
    neutral: false,
    from: "2026-05-02",
    to: "2026-05-20",
    sort: "amount",
    order: "asc",
    page: 3,
    pageSize: 25,
  },
  quick: {},
};
const FULL_SAVED: SavedFilterState = {
  q: "farmácia",
  type: "Expense",
  accountId: "acc-1",
  categoryId: "cat-1",
  neutral: false,
  from: "2026-05-02",
  to: "2026-05-20",
  sort: "amount",
  order: "asc",
};
const INITIAL: FilterState = { filters: { sort: "date", order: "desc", page: 1 }, quick: {} };

describe("toSavedState", () => {
  it("guarda os dez campos e deixa de fora a página e o tamanho da página", () => {
    expect(toSavedState(FULL)).toEqual(FULL_SAVED);
    expect(Object.keys(toSavedState(FULL)).sort()).toEqual(
      ["accountId", "categoryId", "from", "neutral", "order", "q", "sort", "to", "type"].sort(),
    );
  });

  it("não guarda campos vazios e apara a busca; busca em branco é ausente", () => {
    const state: FilterState = { ...INITIAL, filters: { ...INITIAL.filters, q: "  Farm  " } };
    expect(toSavedState(state)).toEqual({ q: "Farm", sort: "date", order: "desc" });
    const blank: FilterState = { ...INITIAL, filters: { ...INITIAL.filters, q: "   " } };
    expect(toSavedState(blank)).toEqual({ sort: "date", order: "desc" });
    expect(toSavedState(INITIAL)).toEqual({ sort: "date", order: "desc" });
  });

  it("o mês rápido completo vira quick com De e Até do mês; incompleto não é guardado", () => {
    const june: FilterState = {
      filters: { ...INITIAL.filters, from: "2026-06-01", to: "2026-06-30" },
      quick: { year: 2026, month: 6 },
    };
    expect(toSavedState(june)).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
      quick: { year: 2026, month: 6 },
      sort: "date",
      order: "desc",
    });
    const onlyYear: FilterState = { ...INITIAL, quick: { year: 2026 } };
    expect(toSavedState(onlyYear)).toEqual({ sort: "date", order: "desc" });
    const onlyMonth: FilterState = { ...INITIAL, quick: { month: 6 } };
    expect(toSavedState(onlyMonth)).toEqual({ sort: "date", order: "desc" });
  });
});

describe("toFilterState", () => {
  it("volta à página 1 com a ordenação guardada, sem pageSize", () => {
    expect(toFilterState(FULL_SAVED)).toEqual({
      filters: { ...FULL_SAVED, page: 1 },
      quick: {},
    });
    expect(toFilterState(FULL_SAVED).filters).not.toHaveProperty("pageSize");
  });

  it("a ordenação ausente do estado guardado vale data decrescente", () => {
    const loose = sanitizeSavedState({ type: "Income" });
    expect(toFilterState(loose)).toEqual({
      filters: { type: "Income", sort: "date", order: "desc", page: 1 },
      quick: {},
    });
  });

  it("o mês rápido guardado dá quick e os dias do mês, mesmo com De e Até diferentes no texto", () => {
    const saved = sanitizeSavedState({
      from: "2020-01-01",
      to: "2020-01-02",
      quick: { year: 2026, month: 2 },
    });
    expect(toFilterState(saved)).toEqual({
      filters: { from: "2026-02-01", to: "2026-02-28", sort: "date", order: "desc", page: 1 },
      quick: { year: 2026, month: 2 },
    });
  });

  it("sem mês rápido guardado o quick fica vazio", () => {
    expect(toFilterState({ from: "2026-05-02", sort: "date", order: "desc" }).quick).toEqual({});
  });

  it("ida e volta de um estado completo devolve o mesmo estado na página 1", () => {
    const roundTrip = toFilterState(toSavedState(FULL));
    expect(roundTrip).toEqual({ filters: { ...FULL_SAVED, page: 1 }, quick: {} });
    expect(roundTrip.filters.pageSize).toBeUndefined();
  });
});

describe("isDefaultState", () => {
  it("é verdadeiro para o estado inicial e para um mês rápido incompleto sozinho", () => {
    expect(isDefaultState(toSavedState(INITIAL))).toBe(true);
    expect(isDefaultState(toSavedState({ ...INITIAL, quick: { year: 2026 } }))).toBe(true);
  });

  it.each([
    ["q", { q: "a" }],
    ["type", { type: "Income" }],
    ["accountId", { accountId: "a" }],
    ["categoryId", { categoryId: "c" }],
    ["neutral", { neutral: false }],
    ["from", { from: "2026-05-02" }],
    ["to", { to: "2026-05-02" }],
    ["quick", { quick: { year: 2026, month: 6 } }],
    ["sort", { sort: "name" }],
    ["order", { order: "asc" }],
  ])("é falso quando só %s difere do inicial", (_name, change) => {
    expect(isDefaultState(sanitizeSavedState(change))).toBe(false);
  });
});

describe("sameSavedState", () => {
  it("ignora a ordem das chaves, a busca em branco e o mês rápido incompleto", () => {
    const reordered: SavedFilterState = {
      order: "asc",
      sort: "amount",
      to: "2026-05-20",
      from: "2026-05-02",
      neutral: false,
      categoryId: "cat-1",
      accountId: "acc-1",
      type: "Expense",
      q: "farmácia",
    };
    expect(sameSavedState(FULL_SAVED, reordered)).toBe(true);
    const blankQ: SavedFilterState = { sort: "date", order: "desc", q: "" };
    expect(sameSavedState(blankQ, { sort: "date", order: "desc" })).toBe(true);
    expect(sameSavedState(toSavedState({ ...FULL, quick: { month: 6 } }), FULL_SAVED)).toBe(true);
  });

  it("ignora a página e o tamanho porque o estado salvo não os tem", () => {
    const page3 = toSavedState(FULL);
    const page1 = toSavedState({ ...FULL, filters: { ...FULL.filters, page: 1 } });
    expect(sameSavedState(page3, page1)).toBe(true);
  });

  it.each([
    ["q", { q: "outra" }],
    ["type", { type: "Income" }],
    ["accountId", { accountId: "acc-2" }],
    ["categoryId", { categoryId: "cat-2" }],
    ["neutral", { neutral: true }],
    ["from", { from: "2026-05-03" }],
    ["to", { to: "2026-05-21" }],
    ["sort", { sort: "name" }],
    ["order", { order: "desc" }],
  ] as const)("é falso quando só %s difere", (_name, change) => {
    expect(sameSavedState(FULL_SAVED, { ...FULL_SAVED, ...change })).toBe(false);
  });

  it("o mês rápido faz diferença e neutra falsa difere de neutra ausente", () => {
    const june: SavedFilterState = sanitizeSavedState({ quick: { year: 2026, month: 6 } });
    const july: SavedFilterState = sanitizeSavedState({ quick: { year: 2026, month: 7 } });
    expect(sameSavedState(june, july)).toBe(false);
    const sameDaysNoQuick: SavedFilterState = {
      from: "2026-06-01",
      to: "2026-06-30",
      sort: "date",
      order: "desc",
    };
    expect(sameSavedState(june, sameDaysNoQuick)).toBe(false);
    const withoutNeutral: SavedFilterState = { ...FULL_SAVED };
    delete withoutNeutral.neutral;
    expect(sameSavedState(FULL_SAVED, withoutNeutral)).toBe(false);
  });
});

describe("withoutMissingRefs", () => {
  const known = { accountIds: new Set(["acc-1"]), categoryIds: new Set(["cat-1"]) };

  it("mantém a conta e a categoria que existem", () => {
    expect(withoutMissingRefs(FULL_SAVED, known)).toEqual({ state: FULL_SAVED, missing: [] });
  });

  it("tira a conta que não existe mais e diz qual faltou", () => {
    const { state, missing } = withoutMissingRefs(FULL_SAVED, {
      ...known,
      accountIds: new Set(["outra"]),
    });
    expect(state).not.toHaveProperty("accountId");
    expect(state.categoryId).toBe("cat-1");
    expect(state.q).toBe("farmácia");
    expect(missing).toEqual(["account"]);
  });

  it("tira a categoria e as duas, nessa ordem de aviso", () => {
    const noCategory = withoutMissingRefs(FULL_SAVED, { ...known, categoryIds: new Set() });
    expect(noCategory.state).not.toHaveProperty("categoryId");
    expect(noCategory.state.accountId).toBe("acc-1");
    expect(noCategory.missing).toEqual(["category"]);
    const both = withoutMissingRefs(FULL_SAVED, {
      accountIds: new Set(),
      categoryIds: new Set(),
    });
    expect(both.missing).toEqual(["account", "category"]);
  });

  it("mantém o campo quando a lista não é conhecida (não carregada)", () => {
    expect(withoutMissingRefs(FULL_SAVED, {})).toEqual({ state: FULL_SAVED, missing: [] });
    const onlyCategories = withoutMissingRefs(FULL_SAVED, { categoryIds: new Set() });
    expect(onlyCategories.state.accountId).toBe("acc-1");
    expect(onlyCategories.missing).toEqual(["category"]);
  });
});

describe("describeSavedState", () => {
  it("descreve cada campo aplicado em português e a ordenação", () => {
    expect(describeSavedState(FULL_SAVED, { account: "Nubank PJ", category: "Saúde" })).toEqual([
      "Busca: farmácia",
      "Tipo: Despesa",
      "Conta: Nubank PJ",
      "Categoria: Saúde",
      "Neutra: Não",
      "De: 02/05/2026",
      "Até: 20/05/2026",
      "Ordenação: Valor (crescente)",
    ]);
  });

  it("usa Receita, Neutra Sim e a ordenação padrão", () => {
    expect(
      describeSavedState({ type: "Income", neutral: true, sort: "date", order: "desc" }),
    ).toEqual(["Tipo: Receita", "Neutra: Sim", "Ordenação: Data (decrescente)"]);
  });

  it("sem os nomes cai nos textos genéricos de conta e categoria", () => {
    expect(
      describeSavedState({ accountId: "a", categoryId: "c", sort: "name", order: "asc" }),
    ).toEqual([
      "Conta: Conta selecionada",
      "Categoria: Categoria selecionada",
      "Ordenação: Nome (crescente)",
    ]);
  });

  it("o mês rápido aparece no lugar de De e Até", () => {
    const june = sanitizeSavedState({ quick: { year: 2026, month: 6 }, sort: "category" });
    expect(describeSavedState(june)).toEqual([
      "Mês: Junho de 2026",
      "Ordenação: Categoria (decrescente)",
    ]);
  });

  it("não tem linha de página nem de itens por página", () => {
    const lines = describeSavedState(toSavedState(FULL)).join("\n");
    expect(lines).not.toMatch(/p[áa]gina|itens/i);
  });
});

describe("sanitizeSavedState", () => {
  it("descarta campos desconhecidos e mantém os válidos", () => {
    const state = sanitizeSavedState({
      ...FULL_SAVED,
      page: 4,
      pageSize: 100,
      extra: "x",
    });
    expect(state).toEqual(FULL_SAVED);
  });

  it("um campo inválido vira ausente e sort e order caem no padrão", () => {
    const state = sanitizeSavedState({
      q: 7,
      type: "Transfer",
      neutral: "false",
      accountId: "",
      categoryId: 3,
      from: "2026-02-30",
      to: "01/06/2026",
      quick: { year: 2026, month: 13 },
      sort: "id",
      order: "up",
    });
    expect(state).toEqual({ sort: "date", order: "desc" });
  });

  it("rejeita ano e mês fora de 1900 a 2100 e de 1 a 12, e números que não são inteiros", () => {
    for (const quick of [
      { year: 1899, month: 1 },
      { year: 2101, month: 1 },
      { year: 2026, month: 0 },
      { year: 2026.5, month: 1 },
      { year: "2026", month: 1 },
      { year: 2026 },
      null,
    ]) {
      expect(sanitizeSavedState({ quick })).toEqual({ sort: "date", order: "desc" });
    }
    expect(sanitizeSavedState({ quick: { year: 2100, month: 12 } }).quick).toEqual({
      year: 2100,
      month: 12,
    });
  });

  it("aceita o dia 29 de fevereiro de ano bissexto e recusa o de ano comum", () => {
    expect(sanitizeSavedState({ from: "2028-02-29" }).from).toBe("2028-02-29");
    expect(sanitizeSavedState({ from: "2026-02-29" }).from).toBeUndefined();
  });

  it("texto acima de 200 caracteres ou em branco é ausente, e aceita o de exatamente 200", () => {
    expect(sanitizeSavedState({ q: "a".repeat(201) }).q).toBeUndefined();
    expect(sanitizeSavedState({ q: "a".repeat(200) }).q).toBe("a".repeat(200));
    expect(sanitizeSavedState({ accountId: "   " }).accountId).toBeUndefined();
  });

  it("tudo o que não é objeto dá o estado vazio", () => {
    for (const raw of [null, undefined, 3, "x", [], true]) {
      expect(sanitizeSavedState(raw)).toEqual({ sort: "date", order: "desc" });
    }
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedFilterState } from "./savedFilterState";
import {
  addSavedFilter,
  deleteSavedFilter,
  readSavedFilters,
  renameSavedFilter,
  savedFiltersKey,
  sortSavedFilters,
  type SavedFilter,
} from "./savedFilters";

// the key is spelled out here on purpose: a renamed key would silently drop every saved filter
const keyOf = (userId: string) => `financials:transactions:saved-filters:${userId}`;
const STATE: SavedFilterState = { type: "Income", sort: "date", order: "desc" };
const entry = (name: string, id = name) => ({ id, name, state: STATE });
const put = (userId: string, value: unknown) =>
  localStorage.setItem(keyOf(userId), typeof value === "string" ? value : JSON.stringify(value));
const stored = (userId: string) => JSON.parse(localStorage.getItem(keyOf(userId)) ?? "null");
const namesOf = (userId: string) => readSavedFilters(userId).filters.map((filter) => filter.name);
const many = (count: number) => Array.from({ length: count }, (_, i) => entry(`Filtro ${i + 1}`));
const denied = () => {
  throw new DOMException("denied", "SecurityError");
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("a chave e o formato guardado", () => {
  it("a chave é financials:transactions:saved-filters:<id do usuário>", () => {
    expect(savedFiltersKey("u-1")).toBe("financials:transactions:saved-filters:u-1");
    addSavedFilter("u-1", "Receitas", STATE);
    expect(localStorage.getItem("financials:transactions:saved-filters:u-1")).not.toBeNull();
  });

  it("guarda { version: 1, filters: [{ id, name, state }] } sem nenhum campo a mais", () => {
    const result = addSavedFilter("u1", "  Receitas  ", { ...STATE, q: "x" });
    expect(result.ok).toBe(true);
    const value = stored("u1");
    expect(Object.keys(value).sort()).toEqual(["filters", "version"]);
    expect(value.version).toBe(1);
    expect(value.filters).toHaveLength(1);
    expect(Object.keys(value.filters[0]).sort()).toEqual(["id", "name", "state"]);
    expect(value.filters[0].name).toBe("Receitas");
    expect(value.filters[0].state).toEqual({ q: "x", type: "Income", sort: "date", order: "desc" });
  });
});

describe("leitura tolerante", () => {
  it.each([
    ["texto que não é JSON", "{isso nao e json"],
    ["texto vazio", ""],
    ["JSON nulo", "null"],
    ["um número", "7"],
    ["uma lista", "[]"],
    ["filters que não é lista", { version: 1, filters: "x" }],
    ["filters ausente", { version: 1 }],
    ["versão 2", { version: 2, filters: [entry("A")] }],
    ["versão ausente", { filters: [entry("A")] }],
  ])("%s dá lista vazia, disponível e sem lançar", (_name, value) => {
    put("u1", value);
    expect(readSavedFilters("u1")).toEqual({ available: true, filters: [] });
  });

  it("sem nada guardado a lista é vazia e disponível", () => {
    expect(readSavedFilters("u1")).toEqual({ available: true, filters: [] });
  });

  it("descarta só a entrada inválida e mantém as demais", () => {
    put("u1", {
      version: 1,
      filters: [
        entry("Boa 1"),
        "texto",
        null,
        { name: "Sem id", state: STATE },
        { id: "", name: "Id vazio", state: STATE },
        { id: "x".repeat(65), name: "Id grande", state: STATE },
        { id: "n1", name: "   ", state: STATE },
        { id: "n2", name: "a".repeat(41), state: STATE },
        { id: "n3", name: 7, state: STATE },
        entry("Boa 2"),
      ],
    });
    expect(namesOf("u1")).toEqual(["Boa 1", "Boa 2"]);
  });

  it("mantém só a primeira com o mesmo id ou o mesmo nome (sem caixa e acento)", () => {
    put("u1", {
      version: 1,
      filters: [
        { id: "a", name: "Mês", state: STATE },
        { id: "a", name: "Outro", state: STATE },
        { id: "b", name: "mes", state: STATE },
        { id: "c", name: "Fim", state: STATE },
      ],
    });
    expect(readSavedFilters("u1").filters.map((f) => [f.id, f.name])).toEqual([
      ["a", "Mês"],
      ["c", "Fim"],
    ]);
  });

  it("com 25 entradas mantém as 20 primeiras", () => {
    put("u1", { version: 1, filters: many(25) });
    expect(namesOf("u1")).toEqual(many(20).map((e) => e.name));
  });

  it("descarta campos desconhecidos da entrada e do estado, e trata o campo inválido como ausente", () => {
    put("u1", {
      version: 1,
      filters: [
        {
          id: "a",
          name: "Com sobra",
          extra: 1,
          state: {
            type: "Transfer",
            neutral: true,
            page: 9,
            pageSize: 100,
            sort: "x",
            order: "asc",
          },
        },
      ],
    });
    const [filter] = readSavedFilters("u1").filters;
    expect(filter).toEqual({
      id: "a",
      name: "Com sobra",
      state: { neutral: true, sort: "date", order: "asc" },
    });
  });

  it("um estado com poucos campos lê os ausentes como vazios", () => {
    put("u1", { version: 1, filters: [{ id: "a", name: "Pouco", state: { q: "mercado" } }] });
    expect(readSavedFilters("u1").filters[0]?.state).toEqual({
      q: "mercado",
      sort: "date",
      order: "desc",
    });
    put("u1", { version: 1, filters: [{ id: "b", name: "Sem estado" }] });
    expect(readSavedFilters("u1").filters[0]?.state).toEqual({ sort: "date", order: "desc" });
  });

  it("getItem lançando dá lista vazia e indisponível, sem lançar", () => {
    put("u1", { version: 1, filters: [entry("A")] });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(denied);
    expect(readSavedFilters("u1")).toEqual({ available: false, filters: [] });
  });

  it("o acesso a localStorage lançando também dá lista vazia e indisponível", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get: denied });
    try {
      expect(readSavedFilters("u1")).toEqual({ available: false, filters: [] });
      expect(addSavedFilter("u1", "A", STATE)).toMatchObject({ ok: false, reason: "storage" });
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
    }
  });
});

describe("isolamento por usuário", () => {
  it("os filtros do usuário A não aparecem para o B, e as ações de um não mexem no outro", () => {
    addSavedFilter("A", "Só do A", STATE);
    expect(namesOf("B")).toEqual([]);
    addSavedFilter("B", "Só do B", STATE);
    const idA = readSavedFilters("A").filters[0]?.id ?? "";
    expect(renameSavedFilter("B", idA, "Invadido")).toMatchObject({
      ok: false,
      reason: "not-found",
    });
    expect(deleteSavedFilter("B", idA)).toMatchObject({ ok: false, reason: "not-found" });
    expect(namesOf("A")).toEqual(["Só do A"]);
    expect(namesOf("B")).toEqual(["Só do B"]);
  });

  it("o mesmo nome pode existir em dois usuários", () => {
    expect(addSavedFilter("A", "Mensal", STATE).ok).toBe(true);
    expect(addSavedFilter("B", "Mensal", STATE).ok).toBe(true);
  });

  it("um id de usuário vazio lê vazio e indisponível e toda ação falha com storage sem tocar no storage", () => {
    const get = vi.spyOn(Storage.prototype, "getItem");
    const set = vi.spyOn(Storage.prototype, "setItem");
    expect(readSavedFilters("")).toEqual({ available: false, filters: [] });
    expect(addSavedFilter("", "A", STATE)).toMatchObject({ ok: false, reason: "storage" });
    expect(renameSavedFilter("", "x", "B")).toMatchObject({ ok: false, reason: "storage" });
    expect(deleteSavedFilter("", "x")).toMatchObject({ ok: false, reason: "storage" });
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });
});

describe("regras do nome", () => {
  it("aparta o nome antes de validar e o guarda aparado", () => {
    expect(addSavedFilter("u1", "   Mês atual   ", STATE).ok).toBe(true);
    expect(namesOf("u1")).toEqual(["Mês atual"]);
  });

  it("nome vazio ou só com espaços falha com invalid-name", () => {
    for (const name of ["", "    "]) {
      expect(addSavedFilter("u1", name, STATE)).toEqual({
        ok: false,
        reason: "invalid-name",
        message: "Informe um nome para o filtro",
      });
    }
    expect(localStorage.getItem(keyOf("u1"))).toBeNull();
  });

  it("41 caracteres falham e 1 e exatamente 40 passam", () => {
    expect(addSavedFilter("u1", "a".repeat(41), STATE)).toEqual({
      ok: false,
      reason: "invalid-name",
      message: "O nome deve ter no máximo 40 caracteres",
    });
    expect(addSavedFilter("u1", "a", STATE).ok).toBe(true);
    expect(addSavedFilter("u1", "b".repeat(40), STATE).ok).toBe(true);
  });

  it("conta os caracteres de um emoji como um só, e o tamanho vale depois de aparar", () => {
    expect(addSavedFilter("u1", `${"😀".repeat(40)}`, STATE).ok).toBe(true);
    expect(addSavedFilter("u1", `  ${"c".repeat(40)}  `, STATE).ok).toBe(true);
  });

  it("nome igual sem diferenciar caixa, acento e espaços repetidos falha com duplicate-name", () => {
    addSavedFilter("u1", "Mês atual", STATE);
    for (const name of ["mes atual", "MÊS ATUAL", "mes  atual", " Mês   Atual "]) {
      expect(addSavedFilter("u1", name, STATE)).toEqual({
        ok: false,
        reason: "duplicate-name",
        message: "Já existe um filtro salvo com esse nome",
      });
    }
    expect(namesOf("u1")).toEqual(["Mês atual"]);
  });

  it("renomear para o nome de outro filtro falha, e para o próprio em outra caixa, acento ou espaço passa", () => {
    addSavedFilter("u1", "Mês", STATE);
    addSavedFilter("u1", "Ano", STATE);
    const mes = readSavedFilters("u1").filters.find((f) => f.name === "Mês");
    expect(renameSavedFilter("u1", mes?.id ?? "", "ano")).toMatchObject({
      ok: false,
      reason: "duplicate-name",
    });
    expect(renameSavedFilter("u1", mes?.id ?? "", "MES").ok).toBe(true);
    expect(renameSavedFilter("u1", mes?.id ?? "", "  mês  ").ok).toBe(true);
    expect(namesOf("u1").sort()).toEqual(["Ano", "mês"]);
  });
});

describe("limite de 20 filtros", () => {
  it("o 21º falha com limit e a mensagem, e depois de excluir um salva", () => {
    put("u1", { version: 1, filters: many(20) });
    expect(addSavedFilter("u1", "Filtro 21", STATE)).toEqual({
      ok: false,
      reason: "limit",
      message: "Limite de 20 filtros salvos atingido. Exclua um para salvar outro.",
    });
    expect(readSavedFilters("u1").filters).toHaveLength(20);
    expect(deleteSavedFilter("u1", "Filtro 3").ok).toBe(true);
    expect(addSavedFilter("u1", "Filtro 21", STATE).ok).toBe(true);
    expect(readSavedFilters("u1").filters).toHaveLength(20);
  });

  it("com 20 filtros um nome vazio, longo ou repetido falha pela regra do nome, e o limite vem por último", () => {
    put("u1", { version: 1, filters: many(20) });
    const reason = (name: string) => {
      const result = addSavedFilter("u1", name, STATE);
      return result.ok ? "ok" : result.reason;
    };
    expect(reason("  ")).toBe("invalid-name");
    expect(reason("a".repeat(41))).toBe("invalid-name");
    expect(reason("filtro 7")).toBe("duplicate-name");
    expect(reason("Novo")).toBe("limit");
    expect(readSavedFilters("u1").filters).toHaveLength(20);
  });

  it("o 20º ainda salva", () => {
    put("u1", { version: 1, filters: many(19) });
    expect(addSavedFilter("u1", "Vigésimo", STATE).ok).toBe(true);
  });
});

describe("salvar, renomear e excluir", () => {
  it("salvar acrescenta uma entrada com o estado sem a página e deixa as anteriores intactas", () => {
    put("u1", { version: 1, filters: [entry("Antigo")] });
    const withPage = { ...STATE, page: 3, pageSize: 25 } as SavedFilterState;
    const result = addSavedFilter("u1", "Novo", withPage);
    expect(result.ok).toBe(true);
    const filters = readSavedFilters("u1").filters;
    expect(filters.map((f) => f.name)).toEqual(["Antigo", "Novo"]);
    expect(filters[0]).toEqual(entry("Antigo"));
    expect(filters[1]?.state).toEqual(STATE);
    expect(JSON.stringify(stored("u1"))).not.toMatch(/page/);
    expect(result.ok && result.filter?.name).toBe("Novo");
  });

  it("renomear muda só o nome daquele id, com o estado e as outras entradas intactos", () => {
    put("u1", {
      version: 1,
      filters: [
        { id: "a", name: "A", state: { ...STATE, q: "um" } },
        { id: "b", name: "B", state: { ...STATE, q: "dois" } },
      ],
    });
    expect(renameSavedFilter("u1", "a", "  Novo A ").ok).toBe(true);
    expect(stored("u1").filters).toEqual([
      { id: "a", name: "Novo A", state: { q: "um", type: "Income", sort: "date", order: "desc" } },
      { id: "b", name: "B", state: { q: "dois", type: "Income", sort: "date", order: "desc" } },
    ]);
  });

  it("excluir tira só a entrada daquele id", () => {
    put("u1", { version: 1, filters: [entry("A"), entry("B"), entry("C")] });
    expect(deleteSavedFilter("u1", "B").ok).toBe(true);
    expect(namesOf("u1")).toEqual(["A", "C"]);
  });

  it("um id que não existe falha com not-found e não grava nada", () => {
    put("u1", { version: 1, filters: [entry("A")] });
    const set = vi.spyOn(Storage.prototype, "setItem");
    const message = "Esse filtro não existe mais";
    expect(renameSavedFilter("u1", "nada", "X")).toEqual({
      ok: false,
      reason: "not-found",
      message,
    });
    expect(deleteSavedFilter("u1", "nada")).toEqual({ ok: false, reason: "not-found", message });
    expect(set).not.toHaveBeenCalled();
    expect(namesOf("u1")).toEqual(["A"]);
  });

  it("reler antes de gravar: o filtro que outra aba criou conta para o nome repetido, o limite e não se perde", () => {
    expect(addSavedFilter("u1", "Primeiro", STATE).ok).toBe(true);
    // another tab saves "Da outra aba" between two actions of this one
    put("u1", {
      version: 1,
      filters: [...readSavedFilters("u1").filters, entry("Da outra aba")],
    });
    expect(addSavedFilter("u1", "da OUTRA aba", STATE)).toMatchObject({
      ok: false,
      reason: "duplicate-name",
    });
    expect(addSavedFilter("u1", "Terceiro", STATE).ok).toBe(true);
    expect(namesOf("u1")).toEqual(["Primeiro", "Da outra aba", "Terceiro"]);
    put("u1", { version: 1, filters: many(20) });
    expect(addSavedFilter("u1", "Estoura", STATE)).toMatchObject({ ok: false, reason: "limit" });
  });
});

describe("falhas do armazenamento", () => {
  it("setItem lançando (cota cheia ou bloqueado) falha com storage e a leitura seguinte devolve a lista de antes", () => {
    put("u1", { version: 1, filters: [entry("A"), entry("B")] });
    const before = localStorage.getItem(keyOf("u1"));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const message =
      "Não foi possível acessar o armazenamento do navegador. Verifique se ele está liberado e tente de novo.";
    expect(addSavedFilter("u1", "C", STATE)).toEqual({ ok: false, reason: "storage", message });
    expect(renameSavedFilter("u1", "A", "Z")).toMatchObject({ ok: false, reason: "storage" });
    expect(deleteSavedFilter("u1", "A")).toMatchObject({ ok: false, reason: "storage" });
    expect(localStorage.getItem(keyOf("u1"))).toBe(before);
    expect(namesOf("u1")).toEqual(["A", "B"]);
  });

  it("getItem lançando numa ação falha com storage e não grava nada", () => {
    put("u1", { version: 1, filters: [entry("A")] });
    const before = localStorage.getItem(keyOf("u1"));
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(denied);
    const set = vi.spyOn(Storage.prototype, "setItem");
    expect(addSavedFilter("u1", "B", STATE)).toMatchObject({ ok: false, reason: "storage" });
    expect(renameSavedFilter("u1", "A", "Z")).toMatchObject({ ok: false, reason: "storage" });
    expect(deleteSavedFilter("u1", "A")).toMatchObject({ ok: false, reason: "storage" });
    expect(set).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    expect(localStorage.getItem(keyOf("u1"))).toBe(before);
  });

  it("o dado corrompido é sobrescrito pela próxima gravação boa", () => {
    put("u1", "isto está corrompido");
    expect(addSavedFilter("u1", "Novo", STATE).ok).toBe(true);
    expect(namesOf("u1")).toEqual(["Novo"]);
  });
});

describe("sortSavedFilters", () => {
  const filter = (name: string, id = name): SavedFilter => ({ id, name, state: STATE });

  it("ordena pelo nome sem diferenciar caixa e acento", () => {
    const sorted = sortSavedFilters([filter("Cebola"), filter("banana"), filter("Água")]);
    expect(sorted.map((f) => f.name)).toEqual(["Água", "banana", "Cebola"]);
  });

  it("nomes iguais na comparação ficam na ordem guardada e a entrada não é alterada", () => {
    const input = [filter("B", "1"), filter("b", "2"), filter("a", "3")];
    expect(sortSavedFilters(input).map((f) => f.id)).toEqual(["3", "1", "2"]);
    expect(input.map((f) => f.id)).toEqual(["1", "2", "3"]);
  });
});

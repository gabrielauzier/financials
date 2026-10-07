import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedFilterState } from "./savedFilterState";
import { SaveFilterDialog } from "./SaveFilterDialog";
import { useSavedFilters } from "./useSavedFilters";

const KEY = "financials:transactions:saved-filters:u1";
const STATE: SavedFilterState = { type: "Income", sort: "date", order: "desc" };
const LINES = ["Tipo: Receita", "Ordenação: Data (decrescente)"];
const storedNames = () =>
  (
    JSON.parse(localStorage.getItem(KEY) ?? '{"filters":[]}').filters as Array<{ name: string }>
  ).map((filter) => filter.name);

/** The dialog with the real hook behind it, opened by a button like the extrato does. */
function Harness() {
  const saved = useSavedFilters("u1");
  return (
    <SaveFilterDialog
      disabled={false}
      lines={LINES}
      atLimit={saved.atLimit}
      onSave={(name) => saved.add(name, STATE)}
    />
  );
}
const opener = () => screen.getByRole("button", { name: "Salvar filtro" });
const openDialog = () => {
  opener().focus();
  fireEvent.click(opener());
  return screen.getByRole("dialog", { name: "Salvar filtro" });
};
const field = () => screen.getByLabelText("Nome do filtro");
const typeName = (value: string) => fireEvent.change(field(), { target: { value } });
const pressEnter = () => fireEvent.keyDown(field(), { key: "Enter" });
const seed = (names: string[]) =>
  localStorage.setItem(
    KEY,
    JSON.stringify({
      version: 1,
      filters: names.map((name) => ({ id: `id-${name}`, name, state: STATE })),
    }),
  );

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("SaveFilterDialog", () => {
  it("abre com título, descrição, campo rotulado vazio e focado, a lista do que será salvo e os dois botões", () => {
    render(<Harness />);
    const dialog = openDialog();
    expect(dialog).toHaveAccessibleDescription(/Dê um nome aos filtros aplicados/);
    expect(field()).toHaveValue("");
    expect(field()).toHaveFocus();
    const list = within(dialog).getByRole("list", { name: "Filtros que serão salvos" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(LINES);
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Salvar" })).toBeEnabled();
  });

  it("'Salvar' guarda o filtro com o nome aparado, fecha o diálogo e devolve o foco ao botão que o abriu", async () => {
    render(<Harness />);
    openDialog();
    typeName("  Receitas de junho  ");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(storedNames()).toEqual(["Receitas de junho"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(opener()).toHaveFocus());
  });

  it("Enter no campo guarda o filtro e fecha, e um segundo Enter não guarda outro", async () => {
    render(<Harness />);
    openDialog();
    typeName("Despesas");
    const input = field();
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(storedNames()).toEqual(["Despesas"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(opener()).toHaveFocus());
  });

  it.each([
    ["vazio", "", "Informe um nome para o filtro"],
    ["só espaços", "     ", "Informe um nome para o filtro"],
    ["com 41 caracteres", "a".repeat(41), "O nome deve ter no máximo 40 caracteres"],
    ["repetido sem caixa nem acento", "mes ATUAL", "Já existe um filtro salvo com esse nome"],
  ])(
    "o nome %s mantém o diálogo aberto, mostra a mensagem sob o campo, foca o campo e não guarda",
    (_n, value, message) => {
      seed(["Mês atual"]);
      render(<Harness />);
      const dialog = openDialog();
      typeName(value);
      // a real click leaves the focus on the button: only the dialog can put it back on the field
      const save = within(dialog).getByRole("button", { name: "Salvar" });
      save.focus();
      fireEvent.click(save);
      const alert = within(dialog).getByRole("alert");
      expect(alert).toHaveTextContent(message);
      expect(field()).toHaveAttribute("aria-invalid", "true");
      expect(field()).toHaveAccessibleDescription(message);
      expect(field()).toHaveFocus();
      expect(screen.getByRole("dialog", { name: "Salvar filtro" })).toBeInTheDocument();
      expect(storedNames()).toEqual(["Mês atual"]);
    },
  );

  it("digitar depois de um erro apaga a mensagem", () => {
    render(<Harness />);
    openDialog();
    pressEnter();
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um nome para o filtro");
    typeName("N");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(field()).not.toHaveAttribute("aria-invalid");
  });

  it("'Cancelar' fecha sem guardar, devolve o foco ao botão e reabrir mostra o campo vazio", async () => {
    render(<Harness />);
    openDialog();
    typeName("Rascunho");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storedNames()).toEqual([]);
    await waitFor(() => expect(opener()).toHaveFocus());
    openDialog();
    expect(field()).toHaveValue("");
  });

  it("Esc fecha sem guardar e devolve o foco ao botão", async () => {
    render(<Harness />);
    openDialog();
    typeName("Rascunho");
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storedNames()).toEqual([]);
    await waitFor(() => expect(opener()).toHaveFocus());
  });

  it("com 20 filtros salvos mostra a mensagem de limite como alerta e 'Salvar' fica desabilitado", () => {
    seed(Array.from({ length: 20 }, (_, i) => `Filtro ${i + 1}`));
    render(<Harness />);
    const dialog = openDialog();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Limite de 20 filtros salvos atingido. Exclua um para salvar outro.",
    );
    const save = within(dialog).getByRole("button", { name: "Salvar" });
    expect(save).toBeDisabled();
    typeName("Mais um");
    pressEnter();
    expect(storedNames()).toHaveLength(20);
    expect(screen.getByRole("dialog", { name: "Salvar filtro" })).toBeInTheDocument();
    // only the limit alert: Enter did not even try to save, so no second (field) error appeared
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("com o botão desligado ele fica desabilitado e não abre o diálogo", () => {
    render(
      <SaveFilterDialog disabled lines={LINES} atLimit={false} onSave={() => ({ ok: true })} />,
    );
    expect(opener()).toBeDisabled();
    fireEvent.click(opener());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("com o armazenamento falhando o diálogo fica aberto com o nome digitado, sem guardar nada", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    render(<Harness />);
    openDialog();
    typeName("Receitas");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("dialog", { name: "Salvar filtro" })).toBeInTheDocument();
    expect(field()).toHaveValue("Receitas");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    vi.restoreAllMocks();
    expect(storedNames()).toEqual([]);
  });
});

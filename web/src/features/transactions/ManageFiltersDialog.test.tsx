import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManageFiltersDialog } from "./ManageFiltersDialog";
import type { SavedFilterState } from "./savedFilterState";
import { useSavedFilters } from "./useSavedFilters";

const KEY = "financials:transactions:saved-filters:u1";
const STATE: SavedFilterState = { type: "Income", sort: "date", order: "desc" };
const seed = (names: string[]) =>
  localStorage.setItem(
    KEY,
    JSON.stringify({
      version: 1,
      filters: names.map((name) => ({ id: `id-${name}`, name, state: STATE })),
    }),
  );
const storedNames = () =>
  (
    JSON.parse(localStorage.getItem(KEY) ?? '{"filters":[]}').filters as Array<{ name: string }>
  ).map((filter) => filter.name);

const menuButton = createRef<HTMLButtonElement>();
/** The dialog with the real hook behind it, opened from a "Filtros salvos" button like the menu does. */
function Harness() {
  const saved = useSavedFilters("u1");
  const [open, setOpen] = useState(true);
  return (
    <>
      <button ref={menuButton} onClick={() => setOpen(true)}>
        Filtros salvos
      </button>
      <ManageFiltersDialog
        open={open}
        onOpenChange={setOpen}
        returnFocusRef={menuButton}
        filters={saved.filters}
        onRename={saved.rename}
        onDelete={saved.remove}
      />
    </>
  );
}
const dialog = () => screen.getByRole("dialog", { name: "Gerenciar filtros" });
const rowNames = () =>
  within(dialog())
    .queryAllByRole("listitem")
    .map((row) => row.querySelector("span")?.textContent);
const startRename = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name: `Renomear ${name}` }));
const nameField = () => screen.getByRole("textbox");
const typeName = (value: string) => fireEvent.change(nameField(), { target: { value } });
const full = () => {
  seed(["Mensal", "Receitas", "Viagem"]);
  render(<Harness />);
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("ManageFiltersDialog", () => {
  it("lista cada filtro na ordem dada com botões nativos 'Renomear <nome>' e 'Excluir <nome>'", () => {
    full();
    expect(dialog()).toHaveAccessibleDescription(/Renomeie ou exclua os filtros salvos/);
    expect(rowNames()).toEqual(["Mensal", "Receitas", "Viagem"]);
    for (const name of ["Mensal", "Receitas", "Viagem"]) {
      for (const action of ["Renomear", "Excluir"]) {
        expect(screen.getByRole("button", { name: `${action} ${name}` }).tagName).toBe("BUTTON");
      }
    }
  });

  it("Renomear mostra o campo com o nome atual selecionado e focado, e os botões Salvar nome e Cancelar", () => {
    full();
    startRename("Receitas");
    const input = screen.getByRole("textbox", {
      name: "Novo nome de Receitas",
    }) as HTMLInputElement;
    expect(input).toHaveValue("Receitas");
    expect(input).toHaveFocus();
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, "Receitas".length]);
    expect(screen.getByRole("button", { name: "Salvar nome" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Renomear Receitas" })).not.toBeInTheDocument();
  });

  it("um nome válido (botão ou Enter) renomeia só aquele filtro e a linha volta ao modo de leitura", () => {
    full();
    startRename("Receitas");
    typeName("  Entradas  ");
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(storedNames()).toEqual(["Mensal", "Entradas", "Viagem"]);
    expect(rowNames()).toEqual(["Entradas", "Mensal", "Viagem"]);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    startRename("Viagem");
    typeName("Férias");
    fireEvent.keyDown(nameField(), { key: "Enter" });
    expect(storedNames()).toEqual(["Mensal", "Entradas", "Férias"]);
    expect(rowNames()).toEqual(["Entradas", "Férias", "Mensal"]);
  });

  it.each([
    ["vazio", "", "Informe um nome para o filtro"],
    ["com 41 caracteres", "a".repeat(41), "O nome deve ter no máximo 40 caracteres"],
    ["igual ao de outro filtro", "mensal", "Já existe um filtro salvo com esse nome"],
  ])(
    "o nome %s mantém a edição, mostra a mensagem sob o campo e não muda nada",
    (_n, value, message) => {
      full();
      startRename("Receitas");
      typeName(value);
      fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
      expect(within(dialog()).getByRole("alert")).toHaveTextContent(message);
      expect(nameField()).toHaveAttribute("aria-invalid", "true");
      expect(nameField()).toHaveAccessibleDescription(message);
      expect(nameField()).toHaveValue(value);
      expect(storedNames()).toEqual(["Mensal", "Receitas", "Viagem"]);
    },
  );

  it("digitar depois de um erro apaga a mensagem", () => {
    full();
    startRename("Receitas");
    typeName("");
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(within(dialog()).getByRole("alert")).toBeInTheDocument();
    typeName("E");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(nameField()).not.toHaveAttribute("aria-invalid");
  });

  it("o próprio nome em outra caixa, acento ou espaço é aceito", () => {
    full();
    startRename("Mensal");
    typeName("  MENSAL ");
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(storedNames()).toEqual(["MENSAL", "Receitas", "Viagem"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("'Cancelar' e Esc na edição terminam só a edição: o nome fica e o diálogo continua aberto", () => {
    full();
    startRename("Receitas");
    typeName("Outro");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(rowNames()).toEqual(["Mensal", "Receitas", "Viagem"]);
    startRename("Viagem");
    typeName("Outro");
    fireEvent.keyDown(nameField(), { key: "Escape" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(dialog()).toBeInTheDocument();
    expect(storedNames()).toEqual(["Mensal", "Receitas", "Viagem"]);
  });

  it("Esc sem edição fecha o diálogo e devolve o foco ao botão Filtros salvos", async () => {
    full();
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(menuButton.current).toHaveFocus());
  });

  it("'Excluir <nome>' pede confirmação sem excluir; 'Excluir' remove só esse filtro e 'Cancelar' mantém", () => {
    full();
    fireEvent.click(screen.getByRole("button", { name: "Excluir Receitas" }));
    const confirm = screen.getByRole("alertdialog", { name: 'Excluir o filtro "Receitas"?' });
    expect(confirm).toHaveAccessibleDescription("Essa ação não pode ser desfeita.");
    expect(storedNames()).toEqual(["Mensal", "Receitas", "Viagem"]);
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(storedNames()).toEqual(["Mensal", "Receitas", "Viagem"]);
    fireEvent.click(screen.getByRole("button", { name: "Excluir Receitas" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(storedNames()).toEqual(["Mensal", "Viagem"]);
    expect(rowNames()).toEqual(["Mensal", "Viagem"]);
  });

  it("com o armazenamento falhando, renomear mantém a edição e excluir mantém a confirmação, com a lista como estava", () => {
    full();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    startRename("Receitas");
    typeName("Entradas");
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(nameField()).toHaveValue("Entradas");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir Viagem" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }),
    );
    const confirm = screen.getByRole("alertdialog", { name: 'Excluir o filtro "Viagem"?' });
    expect(confirm).toBeVisible();
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(rowNames()).toEqual(["Mensal", "Receitas", "Viagem"]);
    vi.restoreAllMocks();
    expect(storedNames()).toEqual(["Mensal", "Receitas", "Viagem"]);
  });

  it("um filtro apagado em outra aba some da lista ao renomear ou excluir, e a confirmação termina", () => {
    full();
    startRename("Receitas");
    typeName("Entradas");
    seed(["Mensal", "Viagem"]);
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(rowNames()).toEqual(["Mensal", "Viagem"]);
    fireEvent.click(screen.getByRole("button", { name: "Excluir Viagem" }));
    seed(["Mensal"]);
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(rowNames()).toEqual(["Mensal"]);
  });

  it("fechar no meio da edição e reabrir mostra a lista sem edição", () => {
    full();
    startRename("Receitas");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filtros salvos" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(rowNames()).toEqual(["Mensal", "Receitas", "Viagem"]);
  });

  it("sem filtros mostra 'Nenhum filtro salvo ainda' e nenhuma linha", () => {
    render(<Harness />);
    expect(within(dialog()).getByText("Nenhum filtro salvo ainda")).toBeInTheDocument();
    expect(within(dialog()).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("depois de excluir o último filtro o diálogo mostra o estado vazio", () => {
    seed(["Único"]);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir Único" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }),
    );
    expect(within(dialog()).getByText("Nenhum filtro salvo ainda")).toBeInTheDocument();
  });
});

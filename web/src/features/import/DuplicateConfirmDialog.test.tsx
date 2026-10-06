import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DuplicateConfirmDialog } from "./DuplicateConfirmDialog";

afterEach(cleanup);

const setup = (props: Partial<Parameters<typeof DuplicateConfirmDialog>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <DuplicateConfirmDialog open count={1} onConfirm={onConfirm} onCancel={onCancel} {...props} />,
  );
  return { onConfirm, onCancel };
};

describe("diálogo de duplicadas (IMPIMP-06)", () => {
  it("mostra o título e a contagem no singular", () => {
    setup({ count: 1 });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Importar linhas duplicadas?")).toBeInTheDocument();
    expect(screen.getByText(/1 linha selecionada já foi importada antes/)).toBeInTheDocument();
  });

  it("mostra a contagem no plural", () => {
    setup({ count: 3 });
    expect(screen.getByText(/3 linhas selecionadas já foram importadas antes/)).toBeInTheDocument();
  });

  it("Importar mesmo assim confirma e Voltar cancela", () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Importar mesmo assim" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Esc cancela sem confirmar", () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("desabilita Importar mesmo assim com disabled", () => {
    const { onConfirm } = setup({ disabled: true });
    const action = screen.getByRole("button", { name: "Importar mesmo assim" });
    expect(action).toBeDisabled();
    fireEvent.click(action);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("não renderiza nada fechado", () => {
    setup({ open: false });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClearButton, FilterField } from "./FilterField";

afterEach(cleanup);

describe("FilterField", () => {
  it("sem onClear mostra só o rótulo ligado ao controle, sem botão de limpar", () => {
    render(
      <FilterField label="Conta" id="f-account">
        <input id="f-account" />
      </FilterField>,
    );
    expect(screen.getByLabelText("Conta")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("com onClear mostra 'Limpar filtro <rótulo>' ao lado do rótulo e chama onClear uma vez por clique", () => {
    const onClear = vi.fn();
    render(
      <FilterField label="Conta" id="f-account" onClear={onClear}>
        <input id="f-account" />
      </FilterField>,
    );
    const button = screen.getByRole("button", { name: "Limpar filtro Conta" });
    expect(button.previousElementSibling).toBe(screen.getByText("Conta"));
    fireEvent.click(button);
    expect(onClear).toHaveBeenCalledTimes(1);
    fireEvent.click(button);
    expect(onClear).toHaveBeenCalledTimes(2);
  });

  it("clearLabel troca o nome do botão e o rótulo continua ligado ao controle", () => {
    render(
      <FilterField label="Mês" clearLabel="Mês rápido" id="f-month" onClear={() => {}}>
        <input id="f-month" />
      </FilterField>,
    );
    expect(screen.getByRole("button", { name: "Limpar filtro Mês rápido" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar filtro Mês" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Mês")).toHaveAttribute("id", "f-month");
  });

  it("ClearButton tem o nome 'Limpar filtro <rótulo>' e chama o tratador", () => {
    const onClick = vi.fn();
    render(<ClearButton label="Busca" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtro Busca" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

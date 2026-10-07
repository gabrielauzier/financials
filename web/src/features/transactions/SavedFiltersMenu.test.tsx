import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SavedFilter } from "./savedFilters";
import { SavedFiltersMenu } from "./SavedFiltersMenu";

const filter = (name: string): SavedFilter => ({
  id: `id-${name}`,
  name,
  state: { sort: "date", order: "desc" },
});
const FILTERS = [filter("Mensal"), filter("Receitas"), filter("Viagem")];

const setup = (over: { filters?: SavedFilter[]; applied?: string[] } = {}) => {
  const onApply = vi.fn();
  const onManage = vi.fn();
  const triggerRef = createRef<HTMLButtonElement>();
  render(
    <SavedFiltersMenu
      filters={over.filters ?? FILTERS}
      appliedIds={new Set(over.applied ?? [])}
      triggerRef={triggerRef}
      onApply={onApply}
      onManage={onManage}
    />,
  );
  return {
    onApply,
    onManage,
    triggerRef,
    trigger: screen.getByRole("button", { name: "Filtros salvos" }),
  };
};
const openBy = (trigger: HTMLElement, key: string) => {
  trigger.focus();
  fireEvent.keyDown(trigger, { key });
  return screen.getByRole("menu");
};
const itemNames = () => screen.getAllByRole("menuitem").map((item) => item.textContent);

afterEach(cleanup);

describe("SavedFiltersMenu", () => {
  it.each(["Enter", " ", "ArrowDown"])(
    "abre com a tecla %j, com um item por filtro na ordem dada e 'Gerenciar filtros' por último",
    (key) => {
      const { trigger } = setup();
      openBy(trigger, key);
      expect(itemNames()).toEqual(["Mensal", "Receitas", "Viagem", "Gerenciar filtros"]);
    },
  );

  it("sem filtros mostra 'Nenhum filtro salvo ainda' e deixa 'Gerenciar filtros' desabilitado", () => {
    const { trigger } = setup({ filters: [] });
    const menu = openBy(trigger, "Enter");
    expect(within(menu).getByText("Nenhum filtro salvo ainda")).toBeInTheDocument();
    expect(itemNames()).toEqual(["Gerenciar filtros"]);
    expect(screen.getByRole("menuitem", { name: "Gerenciar filtros" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("só o item do filtro aplicado tem aria-current e o nome terminado em (aplicado), com visto e destaque", () => {
    const { trigger } = setup({ applied: ["id-Receitas"] });
    openBy(trigger, "Enter");
    const applied = screen.getByRole("menuitem", { name: "Receitas (aplicado)" });
    expect(applied).toHaveAttribute("aria-current", "true");
    expect(applied).toHaveClass("font-medium");
    expect(applied.querySelector("svg")).not.toHaveClass("invisible");
    for (const name of ["Mensal", "Viagem"]) {
      const item = screen.getByRole("menuitem", { name });
      expect(item).not.toHaveAttribute("aria-current");
      expect(item).not.toHaveClass("font-medium");
      expect(item.querySelector("svg")).toHaveClass("invisible");
    }
  });

  it("dois filtros aplicados ficam marcados juntos", () => {
    const { trigger } = setup({ applied: ["id-Mensal", "id-Viagem"] });
    openBy(trigger, "Enter");
    expect(
      screen
        .getAllByRole("menuitem")
        .filter((item) => item.getAttribute("aria-current") === "true")
        .map((item) => item.textContent),
    ).toEqual(["Mensal(aplicado)", "Viagem(aplicado)"]);
  });

  it("Enter num item fecha o menu e aplica aquele filtro", () => {
    const { trigger, onApply } = setup();
    openBy(trigger, "Enter");
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Receitas" }), { key: "Enter" });
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0]?.[0]).toEqual(filter("Receitas"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("Esc fecha sem aplicar e devolve o foco ao botão", async () => {
    const { trigger, onApply } = setup();
    const menu = openBy(trigger, "Enter");
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("entrega o botão pela referência, para quem precisa devolver o foco a ele", () => {
    const { trigger, triggerRef } = setup();
    expect(triggerRef.current).toBe(trigger);
  });

  it("'Gerenciar filtros' chama onManage", () => {
    const { trigger, onManage, onApply } = setup();
    openBy(trigger, "Enter");
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Gerenciar filtros" }), {
      key: "Enter",
    });
    expect(onManage).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });
});

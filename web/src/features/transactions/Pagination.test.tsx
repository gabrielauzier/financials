import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PageSize } from "@/lib/api/types";
import { Pagination } from "./Pagination";

afterEach(cleanup);

type Props = Parameters<typeof Pagination>[0];
function renderBar(over: Partial<Props> = {}) {
  const props: Props = {
    page: 1,
    total: 120,
    pageSize: 50,
    selectedPageSize: 50,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    ...over,
  };
  const utils = render(<Pagination {...props} />);
  return { ...utils, props };
}
const nav = () => screen.getByRole("navigation", { name: "Paginação do extrato" });
const pageButton = (n: number) => within(nav()).getByRole("button", { name: `Página ${n}` });
const queryPageButton = (n: number) => within(nav()).queryByRole("button", { name: `Página ${n}` });
const pageButtons = () => within(nav()).getAllByRole("button", { name: /^Página \d+$/ });
const arrow = (name: "Anterior" | "Próxima") => within(nav()).getByRole("button", { name });
const gaps = () => within(nav()).queryAllByText("…");

describe("Pagination: texto e botões", () => {
  it("120 linhas em páginas de 50, na página 1: texto, botões 1 2 3, Anterior desabilitado e Próxima habilitada", () => {
    renderBar();
    expect(within(nav()).getByText("120 transações · Página 1 de 3")).toBeInTheDocument();
    expect(pageButtons().map((button) => button.textContent)).toEqual(["1", "2", "3"]);
    expect(arrow("Anterior")).toBeDisabled();
    expect(arrow("Próxima")).toBeEnabled();
  });

  it("na última página Próxima fica desabilitada e Anterior habilitada", () => {
    renderBar({ page: 3 });
    expect(within(nav()).getByText("120 transações · Página 3 de 3")).toBeInTheDocument();
    expect(arrow("Próxima")).toBeDisabled();
    expect(arrow("Anterior")).toBeEnabled();
  });

  it("uma única página mostra só o botão 1, com Anterior e Próxima desabilitados", () => {
    renderBar({ total: 50 });
    expect(pageButtons().map((button) => button.textContent)).toEqual(["1"]);
    expect(within(nav()).getByText("50 transações · Página 1 de 1")).toBeInTheDocument();
    expect(arrow("Anterior")).toBeDisabled();
    expect(arrow("Próxima")).toBeDisabled();
  });

  it("51 linhas em páginas de 50 são 2 páginas, e 100 de 100 é 1", () => {
    const { unmount } = renderBar({ total: 51 });
    expect(pageButtons().map((button) => button.textContent)).toEqual(["1", "2"]);
    expect(within(nav()).getByText(/Página 1 de 2/)).toBeInTheDocument();
    unmount();
    renderBar({ total: 100, pageSize: 100, selectedPageSize: 100 });
    expect(pageButtons().map((button) => button.textContent)).toEqual(["1"]);
  });

  it("conta as páginas pelo pageSize devolvido pela API e não pelo tamanho do seletor", () => {
    renderBar({ pageSize: 25, selectedPageSize: 50 });
    expect(within(nav()).getByText("120 transações · Página 1 de 5")).toBeInTheDocument();
    expect(pageButtons().map((button) => button.textContent)).toEqual(["1", "2", "3", "4", "5"]);
    expect(screen.getByLabelText("Itens por página")).toHaveTextContent("50");
  });
});

describe("Pagination: página atual e reticências", () => {
  // 5000 rows of 50 are 100 pages
  it.each([
    [1, ["1", "2", "3", "4", "5", "100"], 1],
    [5, ["1", "4", "5", "6", "100"], 2],
    [50, ["1", "49", "50", "51", "100"], 2],
    [100, ["1", "96", "97", "98", "99", "100"], 1],
  ])(
    "na página %i marca só a atual com aria-current e mostra os botões certos",
    (page, shown, gapCount) => {
      renderBar({ page, total: 5000 });
      expect(pageButtons().map((button) => button.textContent)).toEqual(shown);
      const current = pageButtons().filter(
        (button) => button.getAttribute("aria-current") === "page",
      );
      expect(current.map((button) => button.textContent)).toEqual([String(page)]);
      expect(current[0]).toHaveAccessibleName(`Página ${page}`);
      for (const button of pageButtons().filter((item) => item !== current[0])) {
        expect(button).not.toHaveAttribute("aria-current");
      }
      expect(gaps()).toHaveLength(gapCount);
      // the current page is the filled variant, the others the outline one
      expect(current[0]).toHaveClass("bg-primary", "text-primary-foreground");
      for (const button of pageButtons().filter((item) => item !== current[0])) {
        expect(button).not.toHaveClass("bg-primary");
        expect(button).toHaveClass("border", "bg-background");
      }
    },
  );

  it("as reticências não são botões", () => {
    renderBar({ page: 50, total: 5000 });
    for (const gap of gaps()) {
      expect(gap.closest("button")).toBeNull();
      expect(gap).toHaveAttribute("aria-hidden", "true");
    }
  });
});

describe("Pagination: navegar", () => {
  it("Anterior, Próxima e um botão numerado pedem a página certa", () => {
    const { props } = renderBar({ page: 3, total: 400 });
    fireEvent.click(arrow("Anterior"));
    expect(props.onPageChange).toHaveBeenLastCalledWith(2);
    fireEvent.click(arrow("Próxima"));
    expect(props.onPageChange).toHaveBeenLastCalledWith(4);
    fireEvent.click(pageButton(8));
    expect(props.onPageChange).toHaveBeenLastCalledWith(8);
    fireEvent.click(pageButton(1));
    expect(props.onPageChange).toHaveBeenLastCalledWith(1);
    expect(props.onPageChange).toHaveBeenCalledTimes(4);
  });

  it("clicar na página atual não pede nada, nem os botões desabilitados", () => {
    const { props } = renderBar({ page: 1 });
    fireEvent.click(pageButton(1));
    fireEvent.click(arrow("Anterior"));
    expect(props.onPageChange).not.toHaveBeenCalled();
    expect(queryPageButton(9)).toBeNull();
  });
});

describe("Pagination: itens por página", () => {
  const options = async () => {
    fireEvent.click(screen.getByLabelText("Itens por página"));
    return (await screen.findAllByRole("option")).map((option) => option.textContent);
  };

  it("o seletor mostra o tamanho escolhido", () => {
    renderBar({ selectedPageSize: 25, pageSize: 25 });
    expect(screen.getByLabelText("Itens por página")).toHaveTextContent("25");
    cleanup();
    renderBar({ selectedPageSize: 100, pageSize: 100 });
    expect(screen.getByLabelText("Itens por página")).toHaveTextContent("100");
  });

  it("lista exatamente 25, 50 e 100, nessa ordem", async () => {
    renderBar();
    expect(await options()).toEqual(["25", "50", "100"]);
  });

  it.each([25, 100] as const)("escolher %i pede esse tamanho", async (size) => {
    const { props } = renderBar();
    fireEvent.click(screen.getByLabelText("Itens por página"));
    fireEvent.click(await screen.findByRole("option", { name: String(size) }));
    expect(props.onPageSizeChange).toHaveBeenCalledExactlyOnceWith(size satisfies PageSize);
    expect(props.onPageChange).not.toHaveBeenCalled();
  });
});

describe("Pagination: celular", () => {
  it("o grupo dos números fica escondido abaixo de sm e a barra quebra linha", () => {
    renderBar();
    const group = pageButton(1).parentElement as HTMLElement;
    expect(group).toHaveClass("hidden", "sm:flex");
    expect(arrow("Anterior").parentElement).toHaveClass("flex-wrap");
    // the row that holds the select and the buttons wraps too
    expect(arrow("Anterior").parentElement?.parentElement).toHaveClass("flex", "flex-wrap");
    expect(arrow("Anterior").parentElement).not.toHaveClass("hidden");
    expect(group.contains(arrow("Anterior"))).toBe(false);
    expect(group.contains(arrow("Próxima"))).toBe(false);
  });

  it("todos os botões têm no mínimo 36 px de toque", () => {
    renderBar({ page: 2 });
    for (const button of [arrow("Anterior"), arrow("Próxima"), ...pageButtons()]) {
      expect(button).toHaveClass("min-h-9", "min-w-9");
    }
  });
});

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery, requests, resetSpy, responses } from "@/test/apiSpy";
import { pickDate } from "@/test/datePicker";
import { CardView } from "./CardView";
import { CategoryBreakdown } from "./CategoryBreakdown";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));
});
afterEach(() => {
  cleanup();
  resetSpy();
  vi.useRealTimers();
});

const paths = () => requests.map((request) => request.path);
const categoryPaths = () => paths().filter((path) => path.startsWith("/dashboard/categories"));
const choose = async (label: string, option: string) => {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole("option", { name: option }));
};
const optionNames = () => screen.getAllByRole("option").map((option) => option.textContent);

describe("PeriodSelect: Mês e ano", () => {
  it("fevereiro de 2028 consulta do primeiro ao último dia (bissexto) e mostra as datas em De e Até desabilitados", async () => {
    responses.set("GET /dashboard/years", { years: [2028, 2026] });
    renderWithQuery(<CategoryBreakdown />);
    await screen.findByText("Moradia");
    await choose("Período", "Mês e ano");
    await choose("Mês", "Fevereiro");
    await choose("Ano", "2028");
    await waitFor(() =>
      expect(categoryPaths().at(-1)).toBe("/dashboard/categories?from=2028-02-01&to=2028-02-29"),
    );
    expect(screen.getByLabelText("De")).toBeDisabled();
    expect(screen.getByLabelText("Até")).toBeDisabled();
    expect(screen.getByLabelText("De")).toHaveTextContent("01/02/2028");
    expect(screen.getByLabelText("Até")).toHaveTextContent("29/02/2028");
  });

  it("em ano comum fevereiro termina no dia 28 e a troca de mês consulta o novo mês", async () => {
    responses.set("GET /dashboard/years", { years: [2027, 2026] });
    renderWithQuery(<CategoryBreakdown />);
    await screen.findByText("Moradia");
    await choose("Período", "Mês e ano");
    await choose("Ano", "2027");
    await choose("Mês", "Fevereiro");
    await waitFor(() =>
      expect(categoryPaths().at(-1)).toBe("/dashboard/categories?from=2027-02-01&to=2027-02-28"),
    );
    await choose("Mês", "Abril");
    await waitFor(() =>
      expect(categoryPaths().at(-1)).toBe("/dashboard/categories?from=2027-04-01&to=2027-04-30"),
    );
    expect(screen.getByLabelText("Até")).toHaveTextContent("30/04/2027");
  });

  it("só o mês ou só o ano não consulta a API", async () => {
    renderWithQuery(<CategoryBreakdown />);
    await screen.findByText("Moradia");
    await choose("Período", "Mês e ano");
    await choose("Mês", "Março");
    expect(categoryPaths()).toHaveLength(1);
    expect(screen.getByLabelText("De")).toHaveTextContent("Selecione a data");
  });

  it("lista os 12 meses em português e os anos do usuário mais o ano atual, do mais novo ao mais antigo", async () => {
    responses.set("GET /dashboard/years", { years: [2028, 2024] });
    renderWithQuery(<CategoryBreakdown />);
    await screen.findByText("Moradia");
    await choose("Período", "Mês e ano");
    fireEvent.click(screen.getByLabelText("Mês"));
    await screen.findByRole("option", { name: "Janeiro" });
    expect(optionNames()).toEqual([
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ]);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    fireEvent.click(await screen.findByLabelText("Ano"));
    await screen.findByRole("option", { name: "2028" });
    expect(optionNames()).toEqual(["2028", "2026", "2024"]);
  });

  it("os anos só são pedidos quando Mês e ano está escolhido", async () => {
    renderWithQuery(<CategoryBreakdown />);
    await screen.findByText("Moradia");
    expect(paths()).not.toContain("/dashboard/years");
    await choose("Período", "Mês e ano");
    await waitFor(() => expect(paths()).toContain("/dashboard/years"));
  });

  it("exclusão mútua: em Mês e ano De e Até ficam desabilitados e em Personalizado Mês e Ano ficam desabilitados", async () => {
    renderWithQuery(<CategoryBreakdown />);
    await screen.findByText("Moradia");
    await choose("Período", "Personalizado");
    expect(screen.getByLabelText("De")).toBeEnabled();
    expect(screen.getByLabelText("Até")).toBeEnabled();
    expect(screen.getByLabelText("Mês")).toBeDisabled();
    expect(screen.getByLabelText("Ano")).toBeDisabled();
    await choose("Período", "Mês e ano");
    expect(screen.getByLabelText("De")).toBeDisabled();
    expect(screen.getByLabelText("Até")).toBeDisabled();
    expect(screen.getByLabelText("Mês")).toBeEnabled();
    expect(screen.getByLabelText("Ano")).toBeEnabled();
  });

  it("ao trocar de Personalizado para Mês e ano as datas digitadas deixam de valer e vice-versa", async () => {
    renderWithQuery(<CategoryBreakdown />);
    await screen.findByText("Moradia");
    await choose("Período", "Personalizado");
    pickDate("De", "2026-10-05");
    pickDate("Até", "2026-10-20");
    await waitFor(() =>
      expect(categoryPaths().at(-1)).toBe("/dashboard/categories?from=2026-10-05&to=2026-10-20"),
    );
    await choose("Período", "Mês e ano");
    // month/year still unset: the custom dates must not be used
    const before = categoryPaths().length;
    expect(screen.getByLabelText("De")).toHaveTextContent("Selecione a data");
    await choose("Mês", "Janeiro");
    await choose("Ano", "2026");
    await waitFor(() =>
      expect(categoryPaths().at(-1)).toBe("/dashboard/categories?from=2026-01-01&to=2026-01-31"),
    );
    expect(categoryPaths()).toHaveLength(before + 1);
    await choose("Período", "Personalizado");
    await waitFor(() =>
      expect(categoryPaths().at(-1)).toBe("/dashboard/categories?from=2026-10-05&to=2026-10-20"),
    );
  });

  it("a Visão do cartão usa o mesmo seletor e consulta o mês escolhido", async () => {
    renderWithQuery(<CardView />);
    await choose("Período", "Mês e ano");
    await choose("Mês", "Dezembro");
    await choose("Ano", "2025");
    await waitFor(() =>
      expect(paths().at(-1)).toBe("/dashboard/card?from=2025-12-01&to=2025-12-31"),
    );
  });
});

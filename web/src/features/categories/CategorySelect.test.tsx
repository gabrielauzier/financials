import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockRequest } from "@/lib/api/mock";
import type { Category } from "@/lib/api/types";
import { renderWithQuery, resetSpy, responses } from "@/test/apiSpy";
import { CategoryOptionLabel, CategorySelect } from "./CategorySelect";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
});

describe("CategorySelect (IMPIMP-03)", () => {
  it("aplica o rótulo de acessibilidade e a classe ao gatilho", async () => {
    renderWithQuery(
      <CategorySelect ariaLabel="Categoria de teste" className="h-8" onChange={vi.fn()} />,
    );
    const trigger = await screen.findByRole("combobox", { name: "Categoria de teste" });
    expect(trigger).toHaveClass("h-8");
  });

  it("cada item e o valor exibido usam o conteúdo do CategoryOptionLabel", async () => {
    const [category] = await mockRequest<Category[]>({ method: "GET", path: "/categories" });
    if (!category) throw new Error("seed");
    renderWithQuery(<CategorySelect value={category.id} onChange={vi.fn()} />);
    const trigger = await screen.findByRole("combobox");
    await waitFor(() => expect(trigger).toHaveTextContent(category.name));
    fireEvent.click(trigger);
    expect(await screen.findByRole("option", { name: category.name })).toBeInTheDocument();
    cleanup();
    renderWithQuery(<CategoryOptionLabel category={category} />);
    expect(screen.getByText(category.name)).toBeInTheDocument();
  });

  it("fica desabilitado com Carregando categorias… enquanto a consulta não termina", () => {
    responses.set("GET /categories", () => new Promise(() => {}));
    renderWithQuery(
      <CategorySelect value="30000000-0000-4000-8000-000000000002" onChange={vi.fn()} />,
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent("Carregando categorias…");
  });
});

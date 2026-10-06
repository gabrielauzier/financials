import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockRequest } from "@/lib/api/mock";
import type { Category } from "@/lib/api/types";
import { renderWithQuery, resetSpy, responses } from "@/test/apiSpy";
import { CategorySelect } from "./CategorySelect";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

vi.mock("./CategoryOptionLabel", () => ({
  CategoryOptionLabel: ({ category }: { category: { name: string } }) => (
    <>{`label:${category.name}`}</>
  ),
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

  it("cada item e o valor exibido passam pelo CategoryOptionLabel", async () => {
    const categories = await mockRequest<Category[]>({ method: "GET", path: "/categories" });
    const [category] = categories;
    if (!category) throw new Error("seed");
    renderWithQuery(<CategorySelect value={category.id} onChange={vi.fn()} />);
    const trigger = await screen.findByRole("combobox");
    await waitFor(() => expect(trigger).toHaveTextContent(`label:${category.name}`));
    fireEvent.click(trigger);
    for (const item of categories) {
      expect(await screen.findByRole("option", { name: `label:${item.name}` })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("option")).toHaveLength(categories.length);
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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { GENERIC_ERROR } from "@/lib/api/errorMessages";
import { mockRequest } from "@/lib/api/mock";
import { CategoriesPage } from "./CategoriesPage";
import { CategorySelect } from "./CategorySelect";

const failures = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: async (path: string, options: { method?: string; body?: unknown } = {}) => {
    const method = options.method?.toUpperCase() ?? "GET";
    const key = path.split("?")[0]?.replace(/^\/categories\/[^/]+/, "/categories/:id");
    const failure = failures.get(`${method} ${key}`);
    if (failure) throw failure;
    return mockRequest({ method, path, body: options.body });
  },
}));

function renderQuery(
  ui: ReactNode,
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
afterEach(() => {
  cleanup();
  failures.clear();
});

describe("categorias", () => {
  it("mostra nomes em português e protege categorias de sistema", async () => {
    renderQuery(<CategoriesPage />);
    expect(await screen.findByText("Entretenimento")).toBeInTheDocument();
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Estorno (de compras)")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Renomear Sem categoria" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir Investimentos" })).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Categoria de sistema")).toHaveLength(3);
  });

  it("renomeia uma categoria comum", async () => {
    renderQuery(<CategoriesPage />);
    await screen.findByText("Desejos");
    fireEvent.click(screen.getByRole("button", { name: "Renomear Desejos" }));
    const input = screen.getByLabelText("Nome da categoria");
    fireEvent.change(input, { target: { value: "Objetivos" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(await screen.findByText("Objetivos")).toBeInTheDocument();
  });

  it("exige um destino ao excluir categoria em uso", async () => {
    renderQuery(<CategoriesPage />);
    await screen.findByText("Entretenimento");
    fireEvent.click(screen.getByRole("button", { name: "Excluir Entretenimento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Esta categoria está em uso.")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Categoria de destino"));
    fireEvent.click(await screen.findByRole("option", { name: "Alimentação" }));
    fireEvent.click(screen.getByRole("button", { name: "Mover e excluir" }));
    await waitFor(() => expect(screen.queryByText("Entretenimento")).not.toBeInTheDocument());
  });

  it("lista categorias no seletor e emite o id", async () => {
    const onChange = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(
      ["categories"],
      [
        {
          id: "30000000-0000-4000-8000-000000000004",
          key: "Healthcare",
          name: "Saúde",
          isSystem: false,
          color: "rose-600",
        },
      ],
    );
    renderQuery(
      <>
        <label htmlFor="test-category">Categoria</label>
        <CategorySelect id="test-category" onChange={onChange} />
      </>,
      client,
    );
    fireEvent.click(await screen.findByLabelText("Categoria"));
    fireEvent.click(await screen.findByRole("option", { name: "Saúde" }));
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^30000000/));
  });

  it("mostra em português os erros de criar e renomear vindos da API", async () => {
    renderQuery(<CategoriesPage />);
    await screen.findByText("Alimentação");
    failures.set("POST /categories", new ApiError("duplicate_name", "Name already taken", 409));
    fireEvent.change(screen.getByLabelText("Nova categoria"), { target: { value: "Qualquer" } });
    fireEvent.submit(screen.getByLabelText("Nova categoria").closest("form") as HTMLFormElement);
    expect(await screen.findByText("Já existe uma categoria com esse nome")).toBeInTheDocument();
    failures.set("PATCH /categories/:id", new ApiError("category_protected", "Protected", 403));
    fireEvent.click(screen.getByRole("button", { name: "Renomear Alimentação" }));
    fireEvent.change(screen.getByLabelText("Nome da categoria"), { target: { value: "Outro" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(await screen.findByText("Categoria protegida")).toBeInTheDocument();
    expect(screen.queryByText("Name already taken")).not.toBeInTheDocument();
    expect(screen.queryByText("Protected")).not.toBeInTheDocument();
  });

  it("mostra o texto genérico para um código desconhecido ao excluir", async () => {
    renderQuery(<CategoriesPage />);
    await screen.findByText("Alimentação");
    failures.set("DELETE /categories/:id", new ApiError("brand_new_code", "Kaboom", 500));
    fireEvent.click(screen.getByRole("button", { name: "Excluir Alimentação" }));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    expect(await screen.findByText(GENERIC_ERROR)).toBeInTheDocument();
    expect(screen.queryByText("Kaboom")).not.toBeInTheDocument();
  });

  it("abre o diálogo de destino em reassign_required e mostra erro em português ao mover", async () => {
    renderQuery(<CategoriesPage />);
    await screen.findByText("Alimentação");
    failures.set(
      "DELETE /categories/:id",
      new ApiError("reassign_required", "Choose a destination", 422),
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir Alimentação" }));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Esta categoria está em uso.")).toBeInTheDocument();
    failures.set("DELETE /categories/:id", new ApiError("not_found", "Missing", 404));
    fireEvent.click(screen.getByLabelText("Categoria de destino"));
    fireEvent.click(await screen.findByRole("option", { name: "Saúde" }));
    fireEvent.click(screen.getByRole("button", { name: "Mover e excluir" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText("Registro não encontrado. Atualize a página e tente de novo"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Missing")).not.toBeInTheDocument();
  });
});

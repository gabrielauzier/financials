import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { mockRequest } from "@/lib/api/mock";
import type { Category } from "@/lib/api/types";
import { renderWithQuery, requests, resetSpy, failures } from "@/test/apiSpy";
import { CategoriesPage } from "./CategoriesPage";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
});

const lastRequest = (method: string) => requests.filter((r) => r.method === method).at(-1);

async function pickColor(label: string, name: string) {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole("radio", { name }));
  await waitFor(() => expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument());
}

/** The spy only normalizes ids of other resources, so category failures are keyed by the real id. */
async function failFor(method: string, name: string, error: ApiError) {
  const all = await mockRequest<Category[]>({ method: "GET", path: "/categories" });
  const id = all.find((category) => category.name === name)?.id;
  if (!id) throw new Error(`seed ${name}`);
  failures.set(`${method} /categories/${id}`, error);
}

const createForm = () => screen.getByLabelText("Nova categoria").closest("form") as HTMLFormElement;

describe("category create form color (COLOR-08 AC 3)", () => {
  it("sends the default slate-600 when no color is picked", async () => {
    renderWithQuery(<CategoriesPage />);
    await screen.findByText("Alimentação");
    expect(screen.getByLabelText("Cor")).toHaveTextContent("Ardósia 600");
    fireEvent.change(screen.getByLabelText("Nova categoria"), { target: { value: "Padrão" } });
    fireEvent.submit(createForm());
    await waitFor(() => expect(lastRequest("POST")).toBeDefined());
    expect(lastRequest("POST")?.body).toEqual({ name: "Padrão", color: "slate-600" });
  });

  it("sends name and chosen color, then clears the name and resets the color", async () => {
    renderWithQuery(<CategoriesPage />);
    await screen.findByText("Alimentação");
    fireEvent.change(screen.getByLabelText("Nova categoria"), { target: { value: "Mercado" } });
    await pickColor("Cor", "Verde 600");
    expect(screen.getByLabelText("Cor")).toHaveTextContent("Verde 600");
    fireEvent.submit(createForm());
    await waitFor(() =>
      expect(lastRequest("POST")?.body).toEqual({ name: "Mercado", color: "green-600" }),
    );
    await waitFor(() => expect(screen.getByLabelText("Nova categoria")).toHaveValue(""));
    expect(screen.getByLabelText("Cor")).toHaveTextContent("Ardósia 600");
    const badge = await screen.findByText("Mercado");
    expect(badge).toHaveClass("bg-green-600");
  });

  it("a 422 on color shows the palette message and keeps the typed name (AC 5)", async () => {
    renderWithQuery(<CategoriesPage />);
    await screen.findByText("Alimentação");
    failures.set("POST /categories", new ApiError("validation_error", "bad", 422, "color"));
    fireEvent.change(screen.getByLabelText("Nova categoria"), { target: { value: "Cor ruim" } });
    fireEvent.submit(createForm());
    expect(await screen.findByText("Escolha uma cor da paleta.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nova categoria")).toHaveValue("Cor ruim");
  });
});

describe("category edit form color (COLOR-08 AC 4, 5, 6)", () => {
  const startEdit = async (name: string) => {
    renderWithQuery(<CategoriesPage />);
    await screen.findByText(name);
    fireEvent.click(screen.getByRole("button", { name: `Renomear ${name}` }));
  };

  it("shows the name and the picker with the current color", async () => {
    await startEdit("Pets");
    expect(screen.getByLabelText("Nome da categoria")).toHaveValue("Pets");
    expect(screen.getByLabelText("Cor da categoria")).toHaveTextContent("Amarelo 600");
  });

  it("Salvar categoria sends one PATCH with name and color and shows the new badge", async () => {
    await startEdit("Pets");
    fireEvent.change(screen.getByLabelText("Nome da categoria"), { target: { value: "Bichos" } });
    await pickColor("Cor da categoria", "Rosê 900");
    fireEvent.click(screen.getByRole("button", { name: "Salvar categoria" }));
    const badge = await screen.findByText("Bichos");
    expect(badge).toHaveClass("bg-rose-900");
    const patches = requests.filter((r) => r.method === "PATCH");
    expect(patches).toHaveLength(1);
    expect(patches[0]?.body).toEqual({ name: "Bichos", color: "rose-900" });
    expect(screen.queryByLabelText("Nome da categoria")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar nome" })).not.toBeInTheDocument();
  });

  it("a 422 on color shows the palette message and keeps the edit open", async () => {
    await startEdit("Compras");
    await failFor("PATCH", "Compras", new ApiError("validation_error", "bad", 422, "color"));
    fireEvent.change(screen.getByLabelText("Nome da categoria"), { target: { value: "Lojas" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar categoria" }));
    expect(await screen.findByText("Escolha uma cor da paleta.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da categoria")).toHaveValue("Lojas");
  });

  it("another failure shows the mapped Portuguese text and keeps the edit open", async () => {
    await startEdit("Compras");
    await failFor("PATCH", "Compras", new ApiError("duplicate_name", "dup", 409));
    fireEvent.click(screen.getByRole("button", { name: "Salvar categoria" }));
    expect(await screen.findByText("Já existe uma categoria com esse nome")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da categoria")).toBeInTheDocument();
  });
});

describe("category list badges (COLOR-10 AC 7, 4; COLOR-08 AC 7)", () => {
  it("shows each row as a badge with its color and keeps the button names", async () => {
    renderWithQuery(<CategoriesPage />);
    const food = await screen.findByText("Alimentação");
    expect(food).toHaveClass("bg-orange-600", "text-black");
    expect(screen.getByText("Entretenimento")).toHaveClass("bg-purple-600");
    expect(screen.getByRole("button", { name: "Renomear Alimentação" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir Alimentação" })).toBeInTheDocument();
  });

  it("a system category shows the badge and the lock but no rename, color or delete control", async () => {
    renderWithQuery(<CategoriesPage />);
    const badge = await screen.findByText("Sem categoria");
    expect(badge).toHaveClass("bg-slate-400");
    expect(screen.getAllByLabelText("Categoria de sistema")).toHaveLength(3);
    for (const name of ["Sem categoria", "Estorno (de compras)", "Investimentos"]) {
      expect(screen.queryByRole("button", { name: `Renomear ${name}` })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: `Excluir ${name}` })).not.toBeInTheDocument();
    }
    expect(screen.getAllByLabelText("Cor")).toHaveLength(1); // only the create form picker
  });

  it("the reassign-destination select shows badges in its items", async () => {
    renderWithQuery(<CategoriesPage />);
    await screen.findByText("Entretenimento");
    await failFor("DELETE", "Entretenimento", new ApiError("reassign_required", "x", 422));
    fireEvent.click(screen.getByRole("button", { name: "Excluir Entretenimento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    const dialog = await screen.findByRole("dialog");
    const trigger = within(dialog).getByLabelText("Categoria de destino");
    await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger);
    const option = await screen.findByRole("option", { name: "Alimentação" });
    expect(within(option).getByText("Alimentação")).toHaveClass("bg-orange-600");
    expect(screen.queryByRole("option", { name: "Entretenimento" })).not.toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { GENERIC_ERROR } from "@/lib/api/errorMessages";
import { mockRequest } from "@/lib/api/mock";
import { AccountForm } from "./AccountForm";
import { AccountSelect } from "./AccountSelect";
import { AccountsPage } from "./AccountsPage";

const failures = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: async (path: string, options: { method?: string; body?: unknown } = {}) => {
    const method = options.method?.toUpperCase() ?? "GET";
    const key = path.split("?")[0]?.replace(/^\/accounts\/[^/]+/, "/accounts/:id");
    const failure = failures.get(`${method} ${key}`);
    if (failure) throw failure;
    return mockRequest({ method, path, body: options.body });
  },
}));

function renderQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
afterEach(() => {
  cleanup();
  failures.clear();
});

describe("contas", () => {
  it("exige titular e informa apelido duplicado", async () => {
    renderQuery(<AccountForm open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Apelido"), {
      target: { value: "Conta teste titular" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));
    expect(await screen.findByText("Informe ao menos um titular")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Apelido"), { target: { value: "NUBANK PESSOAL" } });
    fireEvent.change(screen.getByLabelText("Titulares"), { target: { value: "Gabriel" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));
    expect(await screen.findByText("Já existe uma conta com esse apelido")).toBeInTheDocument();
  });

  it("não oferece exclusão e desativa e reativa uma conta", async () => {
    renderQuery(<AccountsPage />);
    const title = await screen.findByRole("heading", { name: "Nubank pessoal" });
    const row = title.closest("article");
    expect(row).not.toBeNull();
    expect(screen.queryByRole("button", { name: /excluir/i })).not.toBeInTheDocument();
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "Desativar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Desativar" }));
    await waitFor(() =>
      expect(within(row as HTMLElement).getByText("Inativa")).toBeInTheDocument(),
    );
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "Reativar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reativar" }));
    await waitFor(() => expect(within(row as HTMLElement).getByText("Ativa")).toBeInTheDocument());
  });

  it("oculta contas inativas no seletor por padrão", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(
      ["accounts", { active: true }],
      [
        {
          id: "active",
          bank: "Nubank",
          nickname: "Ativa",
          holderNames: ["A"],
          active: true,
          createdAt: "2026-01-01",
        },
      ],
    );
    render(
      <QueryClientProvider client={client}>
        <AccountSelect value="active" onChange={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Ativa")).toBeInTheDocument();
    expect(screen.queryByText("Inativa")).not.toBeInTheDocument();
  });

  it.each([
    ["Desativar", "deactivate"],
    ["Reativar", "activate"],
  ])(
    "mantém o diálogo aberto e mostra o erro em português ao falhar em %s",
    async (label, action) => {
      renderQuery(<AccountsPage />);
      const title = await screen.findByRole("heading", { name: "Nubank pessoal" });
      const row = title.closest("article") as HTMLElement;
      if (label === "Reativar") {
        fireEvent.click(within(row).getByRole("button", { name: "Desativar" }));
        fireEvent.click(await screen.findByRole("button", { name: "Desativar" }));
        await waitFor(() => expect(within(row).getByText("Inativa")).toBeInTheDocument());
      }
      failures.set(
        `POST /accounts/:id/${action}`,
        new ApiError("internal_error", "Internal server failure", 500),
      );
      fireEvent.click(within(row).getByRole("button", { name: label }));
      fireEvent.click(await screen.findByRole("button", { name: label }));
      const dialog = await screen.findByRole("alertdialog");
      expect(await within(dialog).findByText(GENERIC_ERROR)).toBeInTheDocument();
      expect(screen.queryByText("Internal server failure")).not.toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: label })).toBeInTheDocument();
      // leave the shared in-memory mock as found: the account must end active
      failures.clear();
      fireEvent.click(within(dialog).getByRole("button", { name: label }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      if (label === "Desativar") {
        fireEvent.click(within(row).getByRole("button", { name: "Reativar" }));
        fireEvent.click(await screen.findByRole("button", { name: "Reativar" }));
      }
      await waitFor(() => expect(within(row).getByText("Ativa")).toBeInTheDocument());
    },
  );

  it("mostra a mensagem do código conhecido ao falhar a mudança de status", async () => {
    renderQuery(<AccountsPage />);
    const title = await screen.findByRole("heading", { name: "Nubank pessoal" });
    const row = title.closest("article") as HTMLElement;
    failures.set(
      "POST /accounts/:id/deactivate",
      new ApiError("not_found", "Account not found", 404),
    );
    fireEvent.click(within(row).getByRole("button", { name: "Desativar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Desativar" }));
    expect(
      await screen.findByText("Registro não encontrado. Atualize a página e tente de novo"),
    ).toBeInTheDocument();
  });

  it("exibe a mensagem em português para apelido duplicado e titular ausente vindos da API", async () => {
    renderQuery(<AccountForm open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Apelido"), { target: { value: "Qualquer" } });
    fireEvent.change(screen.getByLabelText("Titulares"), { target: { value: "Gabriel" } });
    failures.set("POST /accounts", new ApiError("duplicate_name", "Nickname exists", 409));
    fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));
    // duplicate nickname belongs to the nickname field (#account-error)
    expect(await screen.findByText("Já existe uma conta com esse apelido")).toHaveAttribute(
      "id",
      "account-error",
    );
    failures.set("POST /accounts", new ApiError("holder_required", "Holder required", 422));
    fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));
    // a missing holder belongs to the holders field (#holder-error), not to the nickname
    expect(await screen.findByText("Informe ao menos um titular")).toHaveAttribute(
      "id",
      "holder-error",
    );
    expect(screen.queryByText("Nickname exists")).not.toBeInTheDocument();
  });
});

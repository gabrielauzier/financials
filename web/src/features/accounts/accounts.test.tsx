import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AccountForm } from "./AccountForm";
import { AccountSelect } from "./AccountSelect";
import { AccountsPage } from "./AccountsPage";

function renderQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
afterEach(cleanup);

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
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
const signIn = vi.fn();
const signUp = vi.fn();
vi.mock("./useSession", () => ({ useSession: () => ({ signIn, signUp }) }));
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
function renderWithRouter(component: React.ReactNode) {
  const root = createRootRoute();
  const index = createRoute({ getParentRoute: () => root, path: "/", component: () => component });
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}
describe("cadastro", () => {
  it("valida todos os campos vazios", async () => {
    renderWithRouter(<SignupForm />);
    fireEvent.click(await screen.findByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("Informe o nome")).toBeInTheDocument();
    expect(screen.getByText("Informe o apelido")).toBeInTheDocument();
    expect(screen.getByText("Informe o e-mail")).toBeInTheDocument();
    expect(screen.getByText("Informe a senha")).toBeInTheDocument();
  });
  it("valida e-mail e senha", async () => {
    renderWithRouter(<SignupForm />);
    fireEvent.change(await screen.findByLabelText("Nome"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Apelido"), { target: { value: "Ani" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ruim" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("Informe um e-mail válido")).toBeInTheDocument();
    expect(screen.getByText("A senha deve ter pelo menos 8 caracteres")).toBeInTheDocument();
  });
  it("mostra e-mail já cadastrado", async () => {
    signUp.mockResolvedValueOnce({
      data: { user: { identities: [] }, session: null },
      error: null,
    });
    renderWithRouter(<SignupForm />);
    for (const [label, value] of [
      ["Nome", "Ana"],
      ["Apelido", "Ani"],
      ["E-mail", "ana@example.com"],
      ["Senha", "12345678"],
    ] as const)
      fireEvent.change(await screen.findByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("E-mail já cadastrado")).toBeInTheDocument();
  });
  it("mostra e-mail já cadastrado quando o usuário não confirmado volta como novo", async () => {
    signUp.mockResolvedValueOnce({
      data: {
        user: {
          identities: [{}],
          created_at: "2026-10-05T10:00:00.000Z",
          confirmation_sent_at: "2026-10-05T10:03:00.000Z",
        },
        session: null,
      },
      error: null,
    });
    renderWithRouter(<SignupForm />);
    for (const [label, value] of [
      ["Nome", "Ana"],
      ["Apelido", "Ani"],
      ["E-mail", "ana@example.com"],
      ["Senha", "12345678"],
    ] as const)
      fireEvent.change(await screen.findByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    const message = await screen.findByText("E-mail já cadastrado");
    expect(message).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveAccessibleDescription("E-mail já cadastrado");
    expect(screen.queryByText("Verifique seu e-mail")).not.toBeInTheDocument();
  });
  it("mostra falha de confirmação e sucesso", async () => {
    signUp
      .mockResolvedValueOnce({ data: { user: null, session: null }, error: { code: "mail_error" } })
      .mockResolvedValueOnce({ data: { user: { identities: [{}] }, session: null }, error: null });
    const { unmount } = renderWithRouter(<SignupForm />);
    for (const [label, value] of [
      ["Nome", "Ana"],
      ["Apelido", "Ani"],
      ["E-mail", "ana@example.com"],
      ["Senha", "12345678"],
    ] as const)
      fireEvent.change(await screen.findByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(
      await screen.findByText("Não foi possível enviar o e-mail de confirmação. Tente novamente."),
    ).toBeInTheDocument();
    unmount();
    renderWithRouter(<SignupForm />);
    for (const [label, value] of [
      ["Nome", "Ana"],
      ["Apelido", "Ani"],
      ["E-mail", "ana@example.com"],
      ["Senha", "12345678"],
    ] as const)
      fireEvent.change(await screen.findByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("Verifique seu e-mail")).toBeInTheDocument();
  });
});
describe("login", () => {
  it.each([
    [{ code: "invalid_credentials" }, "E-mail ou senha incorretos"],
    [
      { code: "email_not_confirmed" },
      "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.",
    ],
    [new TypeError("network"), "Serviço indisponível no momento. Tente novamente em instantes."],
  ])("mostra o erro esperado", async (reason, message) => {
    signIn.mockRejectedValueOnce(reason);
    renderWithRouter(<LoginForm />);
    fireEvent.change(await screen.findByLabelText("E-mail"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});

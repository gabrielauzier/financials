import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { mockRequest } from "@/lib/api/mock";
import { GENERIC_ERROR } from "@/lib/api/errorMessages";
import type { Transaction, TransactionsPage } from "@/lib/api/types";
import { requests, resetSpy } from "@/test/apiSpy";
import { TransactionForm } from "./TransactionForm";

vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("sonner")>()),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

const GROUP = "Identificadores da transação";

beforeEach(() => {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});
afterEach(() => {
  cleanup();
  resetSpy();
  Reflect.deleteProperty(navigator, "clipboard");
});

const clipboard = (writeText: unknown) =>
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: writeText });
const withClipboard = (writeText: (text: string) => Promise<void>) => clipboard({ writeText });

const listed = async () =>
  (await mockRequest<TransactionsPage>({ method: "GET", path: "/transactions" })).items;
const imported = async () =>
  (await listed()).find((item) => item.identifier !== null) as Transaction;
const manual = async () => (await listed()).find((item) => item.identifier === null) as Transaction;

const renderForm = (transaction?: Transaction) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const element = (current?: Transaction) => (
    <TransactionForm open onOpenChange={() => {}} {...(current ? { transaction: current } : {})} />
  );
  const view = render(element(transaction), { wrapper });
  return { rerenderWith: (current?: Transaction) => view.rerender(element(current)) };
};
const group = () => screen.getByRole("group", { name: GROUP });

describe("modal de edição: identificadores somente leitura", () => {
  it("mostra o ID do banco e o identificador externo como texto exato, com os rótulos", async () => {
    const item = await imported();
    renderForm(item);
    const box = group();
    expect(within(box).getByText("ID")).toBeInTheDocument();
    expect(within(box).getByText("Identificador externo")).toBeInTheDocument();
    expect(within(box).getByTestId("transaction-id").textContent).toBe(item.id);
    expect(within(box).getByTestId("transaction-identifier").textContent).toBe(item.identifier);
  });

  it("transação manual sem identificador mostra '—' e não tem o botão de copiar do identificador", async () => {
    renderForm(await manual());
    const box = group();
    expect(within(box).getByTestId("transaction-identifier")).toHaveTextContent(/^—$/);
    expect(
      within(box).queryByRole("button", { name: "Copiar identificador externo" }),
    ).not.toBeInTheDocument();
    expect(within(box).getByRole("button", { name: "Copiar ID" })).toBeInTheDocument();
  });

  it("não oferece campo editável para os valores e o PATCH enviado não leva id nem identifier", async () => {
    const item = await imported();
    renderForm(item);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByDisplayValue(item.id)).not.toBeInTheDocument();
    expect(within(dialog).queryByDisplayValue(item.identifier as string)).not.toBeInTheDocument();
    expect(within(group()).queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(requests.filter((request) => request.method === "PATCH")).toHaveLength(1),
    );
    const body = requests.find((request) => request.method === "PATCH")?.body as object;
    expect(Object.keys(body)).not.toContain("id");
    expect(Object.keys(body)).not.toContain("identifier");
  });

  it("o formulário de criação não mostra o bloco de identificadores", () => {
    renderForm();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: GROUP })).not.toBeInTheDocument();
    expect(screen.queryByText("Identificador externo")).not.toBeInTheDocument();
  });

  it("ao reabrir para outra transação, mostra os identificadores da nova", async () => {
    const first = await imported();
    const second = (await listed()).find(
      (item) => item.identifier !== null && item.id !== first.id,
    ) as Transaction;
    const view = renderForm(first);
    expect(within(group()).getByTestId("transaction-id")).toHaveTextContent(first.id);
    view.rerenderWith(second);
    expect(within(group()).getByTestId("transaction-id")).toHaveTextContent(second.id);
    expect(within(group()).getByTestId("transaction-identifier")).toHaveTextContent(
      second.identifier as string,
    );
  });
});

describe("modal de edição: copiar identificadores", () => {
  it("'Copiar ID' escreve o id exato e mostra o toast 'ID copiado'", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);
    const item = await imported();
    renderForm(item);
    fireEvent.click(within(group()).getByRole("button", { name: "Copiar ID" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledExactlyOnceWith("ID copiado"));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(item.id);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("'Copiar identificador externo' escreve o identificador exato e mostra o toast próprio", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);
    const item = await imported();
    renderForm(item);
    fireEvent.click(within(group()).getByRole("button", { name: "Copiar identificador externo" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledExactlyOnceWith("Identificador externo copiado"),
    );
    expect(writeText).toHaveBeenCalledExactlyOnceWith(item.identifier);
  });

  it("copia o valor sem alterá-lo: espaços nas pontas do identificador e do ID chegam intactos", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);
    renderForm({ ...(await imported()), id: "  ID-Y  ", identifier: "  ID-X  " });
    fireEvent.click(within(group()).getByRole("button", { name: "Copiar identificador externo" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenLastCalledWith("  ID-X  ");
    fireEvent.click(within(group()).getByRole("button", { name: "Copiar ID" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(writeText).toHaveBeenLastCalledWith("  ID-Y  ");
  });

  it("escrita rejeitada mostra o toast de erro em português e mantém o modal aberto", async () => {
    withClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    renderForm(await imported());
    fireEvent.click(within(group()).getByRole("button", { name: "Copiar ID" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith(GENERIC_ERROR));
    expect(GENERIC_ERROR).toBe("Não foi possível concluir a operação. Tente novamente.");
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sem navigator.clipboard (contexto sem HTTPS) mostra o toast de erro e mantém o modal aberto", async () => {
    clipboard(undefined);
    renderForm(await imported());
    fireEvent.click(within(group()).getByRole("button", { name: "Copiar identificador externo" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith(GENERIC_ERROR));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

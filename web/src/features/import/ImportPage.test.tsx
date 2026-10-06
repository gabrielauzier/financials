import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { listMockCategories } from "@/lib/api/mock/categories";
import type { ImportPreview, PreviewRow } from "@/lib/api/types";
import { ImportPage } from "./ImportPage";

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest,
}));
vi.mock("@/features/accounts/AccountSelect", () => ({
  AccountSelect: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value?: string;
    onChange: (id: string) => void;
  }) => (
    <select id={id} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
      <option value="">Selecione uma conta</option>
      <option value="acc-1">Nubank pessoal</option>
    </select>
  ),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const UNCATEGORIZED = "30000000-0000-4000-8000-000000000012";
const TRANSPORT = "30000000-0000-4000-8000-000000000007";

const row = (index: number, status: PreviewRow["status"]): PreviewRow => ({
  index,
  localDate: "2026-03-05",
  type: "Expense",
  amount: "10.00",
  name: `Linha ${index}`,
  paymentMethod: "PIX",
  categoryId: UNCATEGORIZED,
  categoryName: "Sem categoria",
  status,
  neutral: false,
  counterpartyDocument: null,
  counterpartyBank: null,
});
const preview: ImportPreview = {
  rows: [row(0, "new"), row(1, "duplicate"), row(2, "ignored")],
  totals: { new: 1, duplicate: 1, ignored: 1, unrecognized: 0, invalid: 0 },
};

const file = new File(["a,b"], "extrato.csv", { type: "text/csv" });
let confirmResponses: Array<() => Promise<unknown>>;
const callsTo = (path: string) =>
  apiRequest.mock.calls.filter(([calledPath]) => calledPath === path);
const bodyOf = (path: string, position = 0) => {
  const call = callsTo(path)[position] as [string, { body: FormData }] | undefined;
  if (!call) throw new Error(`no call ${position} to ${path}`);
  return call[1].body;
};

beforeEach(() => {
  confirmResponses = [];
  apiRequest.mockReset();
  apiRequest.mockImplementation((path: string) => {
    if (path === "/categories") return Promise.resolve(listMockCategories());
    if (path === "/imports/preview") return Promise.resolve(preview);
    if (path === "/imports/confirm") {
      const next = confirmResponses.shift();
      return next ? next() : Promise.resolve({ batchId: "b1", imported: 1, skipped: 2 });
    }
    return Promise.reject(new Error(`unexpected ${path}`));
  });
});
afterEach(cleanup);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ImportPage />
    </QueryClientProvider>,
  );
}

async function goToPreview() {
  fireEvent.change(screen.getByLabelText("Conta"), { target: { value: "acc-1" } });
  fireEvent.change(screen.getByLabelText("Arquivo CSV"), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "Gerar prévia" }));
  await screen.findByRole("button", { name: "Confirmar importação" });
}

describe("página de importação", () => {
  it("percorre conta e arquivo, prévia e resumo enviando só as linhas marcadas", async () => {
    renderPage();
    await goToPreview();
    const previewBody = bodyOf("/imports/preview");
    expect(previewBody.get("file")).toBe(file);
    expect(previewBody.get("accountId")).toBe("acc-1");
    expect(callsTo("/imports/confirm")).toHaveLength(0);

    fireEvent.click(screen.getByRole("switch", { name: "Marcar Linha 0 como neutra" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar importação" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "1 transação importada, 2 ignoradas",
    );

    const confirmBody = bodyOf("/imports/confirm");
    expect(confirmBody.get("file")).toBe(file);
    expect(confirmBody.get("accountId")).toBe("acc-1");
    expect(confirmBody.get("idempotencyKey")).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(confirmBody.get("selections") as string)).toEqual([
      { index: 0, neutral: true, categoryId: UNCATEGORIZED },
    ]);
    expect(screen.getByRole("link", { name: "Ver extrato" })).toHaveAttribute("href", "/extrato");
  });

  it("cancelar volta ao primeiro passo sem chamar a confirmação", async () => {
    renderPage();
    await goToPreview();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByRole("button", { name: "Gerar prévia" })).toBeInTheDocument();
    expect(callsTo("/imports/confirm")).toHaveLength(0);
    expect(callsTo("/imports/preview")).toHaveLength(1);
  });

  it("desabilita a confirmação com zero linhas selecionadas", async () => {
    renderPage();
    await goToPreview();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Linha 0" }));
    expect(screen.getByText("0 linhas selecionadas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar importação" })).toBeDisabled();
  });

  it("em erro de gravação mantém a prévia e reenvia com a mesma chave", async () => {
    confirmResponses = [() => Promise.reject(new ApiError("storage_error", "S3 down", 500))];
    renderPage();
    await goToPreview();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar importação" }));
    expect(await screen.findByText("Nada foi importado. Tente novamente.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Selecionar Linha 1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("status")).toHaveTextContent("1 transação importada");
    const first = bodyOf("/imports/confirm", 0);
    const second = bodyOf("/imports/confirm", 1);
    expect(second.get("idempotencyKey")).toBe(first.get("idempotencyKey"));
    expect(second.get("file")).toBe(first.get("file"));
    expect(second.get("selections")).toBe(first.get("selections"));
  });

  it("uma nova prévia abre uma nova sessão com outra chave", async () => {
    confirmResponses = [() => Promise.reject(new ApiError("storage_error", "x", 500))];
    renderPage();
    await goToPreview();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar importação" }));
    await screen.findByText("Nada foi importado. Tente novamente.");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Gerar prévia" }));
    await screen.findByRole("button", { name: "Confirmar importação" });
    expect(screen.queryByText("Nada foi importado. Tente novamente.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar importação" }));
    await screen.findByRole("status");
    const first = bodyOf("/imports/confirm", 0);
    const second = bodyOf("/imports/confirm", 1);
    expect(second.get("idempotencyKey")).not.toBe(first.get("idempotencyKey"));
  });

  it("mostra o erro da prévia em português e permanece no primeiro passo", async () => {
    apiRequest.mockImplementation(() =>
      Promise.reject(new ApiError("bank_mismatch", "Bank mismatch", 422)),
    );
    renderPage();
    fireEvent.change(screen.getByLabelText("Conta"), { target: { value: "acc-1" } });
    fireEvent.change(screen.getByLabelText("Arquivo CSV"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Gerar prévia" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Formato incompatível com a conta selecionada",
      ),
    );
    expect(screen.queryByRole("button", { name: "Confirmar importação" })).not.toBeInTheDocument();
  });

  it("Importar outro arquivo volta ao início com o arquivo limpo", async () => {
    renderPage();
    await goToPreview();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar importação" }));
    await screen.findByRole("status");
    fireEvent.click(screen.getByRole("button", { name: "Importar outro arquivo" }));
    expect(await screen.findByRole("button", { name: "Gerar prévia" })).toBeDisabled();
  });
});

describe("página de importação: categoria por linha (IMPIMP-03)", () => {
  it("o confirm envia a categoria escolhida para a linha alterada e a do preview para as outras", async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === "/categories") return Promise.resolve(listMockCategories());
      if (path === "/imports/preview")
        return Promise.resolve({
          rows: [
            row(0, "new"),
            { ...row(1, "new"), categoryId: TRANSPORT, categoryName: "Transporte" },
          ],
          totals: { new: 2, duplicate: 0, ignored: 0, unrecognized: 0, invalid: 0 },
        });
      return Promise.resolve({ batchId: "b1", imported: 2, skipped: 0 });
    });
    renderPage();
    await goToPreview();
    const trigger = await screen.findByRole("combobox", { name: "Categoria de Linha 0" });
    await waitFor(() => expect(trigger).toHaveTextContent("Sem categoria"));
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: "Alimentação" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar importação" }));
    await screen.findByRole("status");
    expect(JSON.parse(bodyOf("/imports/confirm").get("selections") as string)).toEqual([
      { index: 0, neutral: false, categoryId: "30000000-0000-4000-8000-000000000002" },
      { index: 1, neutral: false, categoryId: TRANSPORT },
    ]);
  });
});

describe("página de importação: transferências próprias neutras (IMPFIX-10)", () => {
  const neutralRow = (index: number, name: string, neutral: boolean): PreviewRow => ({
    ...row(index, "new"),
    name,
    neutral,
  });
  const neutralPreview: ImportPreview = {
    rows: [
      neutralRow(0, "Maria Souza Lima", true),
      neutralRow(1, "MARIA SOUZA LIMA LTDA", true),
      neutralRow(2, "Padaria Estrela Azul", false),
    ],
    totals: { new: 3, duplicate: 0, ignored: 0, unrecognized: 0, invalid: 0 },
  };
  const sentSelections = () =>
    JSON.parse(bodyOf("/imports/confirm").get("selections") as string) as unknown;

  beforeEach(() => {
    apiRequest.mockImplementation((path: string) => {
      if (path === "/categories") return Promise.resolve(listMockCategories());
      if (path === "/imports/preview") return Promise.resolve(neutralPreview);
      if (path === "/imports/confirm")
        return Promise.resolve({ batchId: "b1", imported: 3, skipped: 0 });
      return Promise.reject(new Error(`unexpected ${path}`));
    });
  });

  it("mostra as chaves ligadas nas linhas neutras e envia neutral true para elas no confirm", async () => {
    renderPage();
    await goToPreview();
    expect(
      screen.getByRole("switch", { name: "Marcar Maria Souza Lima como neutra" }),
    ).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Marcar MARIA SOUZA LIMA LTDA como neutra" }),
    ).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Marcar Padaria Estrela Azul como neutra" }),
    ).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar importação" }));
    await screen.findByRole("status");
    expect(sentSelections()).toEqual([
      { index: 0, neutral: true, categoryId: UNCATEGORIZED },
      { index: 1, neutral: true, categoryId: UNCATEGORIZED },
      { index: 2, neutral: false, categoryId: UNCATEGORIZED },
    ]);
  });

  it("envia neutral false para a linha cuja chave Neutra o usuário desligou", async () => {
    renderPage();
    await goToPreview();
    fireEvent.click(screen.getByRole("switch", { name: "Marcar Maria Souza Lima como neutra" }));
    expect(
      screen.getByRole("switch", { name: "Marcar Maria Souza Lima como neutra" }),
    ).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar importação" }));
    await screen.findByRole("status");
    expect(sentSelections()).toEqual([
      { index: 0, neutral: false, categoryId: UNCATEGORIZED },
      { index: 1, neutral: true, categoryId: UNCATEGORIZED },
      { index: 2, neutral: false, categoryId: UNCATEGORIZED },
    ]);
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { listMockCategories } from "@/lib/api/mock/categories";
import type { ImportedFile, ImportPreview, PreviewRow } from "@/lib/api/types";
import { ImportPage } from "./ImportPage";

const apiRequest = vi.hoisted(() => vi.fn());
const apiRequestBlob = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest,
  apiRequestBlob,
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
      <option value="acc-2">Outra conta</option>
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
  apiRequestBlob.mockReset();
  apiRequest.mockImplementation((path: string) => {
    if (path === "/categories") return Promise.resolve(listMockCategories());
    if (path === "/imports") return Promise.resolve([]);
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
    apiRequest.mockImplementation((path: string) =>
      path === "/imports"
        ? Promise.resolve([])
        : Promise.reject(new ApiError("bank_mismatch", "Bank mismatch", 422)),
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

describe("página de importação: confirmação de duplicadas (IMPIMP-06)", () => {
  const confirmButton = () => screen.getByRole("button", { name: "Confirmar importação" });
  const selectDuplicate = () =>
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Linha 1" }));
  const importAnyway = () =>
    fireEvent.click(screen.getByRole("button", { name: "Importar mesmo assim" }));

  it("com uma duplicada selecionada abre o diálogo e não envia o confirm", async () => {
    renderPage();
    await goToPreview();
    selectDuplicate();
    fireEvent.click(confirmButton());
    expect(await screen.findByText("Importar linhas duplicadas?")).toBeInTheDocument();
    expect(screen.getByText(/1 linha selecionada já foi importada antes/)).toBeInTheDocument();
    expect(callsTo("/imports/confirm")).toHaveLength(0);
  });

  it("mostra a contagem no plural com 3 duplicadas selecionadas", async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === "/categories") return Promise.resolve(listMockCategories());
      if (path === "/imports") return Promise.resolve([]);
      if (path === "/imports/preview")
        return Promise.resolve({
          rows: [row(0, "duplicate"), row(1, "duplicate"), row(2, "duplicate")],
          totals: { new: 0, duplicate: 3, ignored: 0, unrecognized: 0, invalid: 0 },
        });
      return Promise.resolve({ batchId: "b1", imported: 3, skipped: 0 });
    });
    renderPage();
    await goToPreview();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todas as linhas" }));
    fireEvent.click(confirmButton());
    expect(
      await screen.findByText(/3 linhas selecionadas já foram importadas antes/),
    ).toBeInTheDocument();
    expect(callsTo("/imports/confirm")).toHaveLength(0);
  });

  it("sem duplicada selecionada envia o confirm direto, sem diálogo", async () => {
    renderPage();
    await goToPreview();
    fireEvent.click(confirmButton());
    await screen.findByRole("status");
    expect(callsTo("/imports/confirm")).toHaveLength(1);
    expect(screen.queryByText("Importar linhas duplicadas?")).not.toBeInTheDocument();
  });

  it("Importar mesmo assim envia o confirm uma vez com as mesmas seleções", async () => {
    renderPage();
    await goToPreview();
    selectDuplicate();
    fireEvent.click(confirmButton());
    await screen.findByText("Importar linhas duplicadas?");
    importAnyway();
    await screen.findByRole("status");
    expect(callsTo("/imports/confirm")).toHaveLength(1);
    expect(JSON.parse(bodyOf("/imports/confirm").get("selections") as string)).toEqual([
      { index: 0, neutral: false, categoryId: UNCATEGORIZED },
      { index: 1, neutral: false, categoryId: UNCATEGORIZED },
    ]);
  });

  it("Voltar e Esc fecham o diálogo, não enviam nada e mantêm seleção, categorias e Neutra", async () => {
    renderPage();
    await goToPreview();
    selectDuplicate();
    fireEvent.click(screen.getByRole("switch", { name: "Marcar Linha 0 como neutra" }));
    const trigger = await screen.findByRole("combobox", { name: "Categoria de Linha 0" });
    await waitFor(() => expect(trigger).toHaveTextContent("Sem categoria"));
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: "Alimentação" }));
    await waitFor(() => expect(trigger).toHaveTextContent("Alimentação"));

    for (const close of [
      () => fireEvent.click(screen.getByRole("button", { name: "Voltar" })),
      () => fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" }),
    ]) {
      fireEvent.click(confirmButton());
      await screen.findByText("Importar linhas duplicadas?");
      close();
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(callsTo("/imports/confirm")).toHaveLength(0);
      expect(screen.getByRole("checkbox", { name: "Selecionar Linha 1" })).toBeChecked();
      expect(screen.getByRole("switch", { name: "Marcar Linha 0 como neutra" })).toBeChecked();
      expect(screen.getByRole("combobox", { name: "Categoria de Linha 0" })).toHaveTextContent(
        "Alimentação",
      );
      expect(screen.getByText("2 linhas selecionadas")).toBeInTheDocument();
    }
  });

  it("com o confirm em andamento o botão fica desabilitado e um segundo clique não abre diálogo nem envia", async () => {
    let release: (value: unknown) => void = () => {};
    confirmResponses = [() => new Promise((resolve) => (release = resolve))];
    renderPage();
    await goToPreview();
    selectDuplicate();
    fireEvent.click(confirmButton());
    await screen.findByText("Importar linhas duplicadas?");
    importAnyway();
    const pending = await screen.findByRole("button", { name: "Importando…" });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(callsTo("/imports/confirm")).toHaveLength(1);
    release({ batchId: "b1", imported: 2, skipped: 1 });
    await screen.findByRole("status");
  });

  it("depois de uma falha, Tentar novamente reenvia com a mesma chave e sem reabrir o diálogo", async () => {
    confirmResponses = [() => Promise.reject(new ApiError("internal_error", "x", 500))];
    renderPage();
    await goToPreview();
    selectDuplicate();
    fireEvent.click(confirmButton());
    await screen.findByText("Importar linhas duplicadas?");
    importAnyway();
    await screen.findByText("Nada foi importado. Tente novamente.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("status");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    const first = bodyOf("/imports/confirm", 0);
    const second = bodyOf("/imports/confirm", 1);
    expect(callsTo("/imports/confirm")).toHaveLength(2);
    expect(second.get("idempotencyKey")).toBe(first.get("idempotencyKey"));
    expect(second.get("selections")).toBe(first.get("selections"));
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
      if (path === "/imports") return Promise.resolve([]);
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

describe("página de importação: arquivos importados e reimportação (IMPIMP-11, IMPIMP-12, IMPIMP-13)", () => {
  const stored = (over: Partial<ImportedFile> = {}): ImportedFile => ({
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    filename: "extrato-marco.csv",
    mimeType: "text/csv",
    sizeBytes: 3,
    bank: "Nubank",
    account: { id: "acc-1", nickname: "Nubank pessoal" },
    createdAt: "2026-03-05T12:00:00.000Z",
    rowCount: 3,
    importedCount: 2,
    skippedCount: 1,
    ...over,
  });
  let files: ImportedFile[];

  beforeEach(() => {
    files = [stored()];
    apiRequestBlob.mockReset();
    apiRequestBlob.mockResolvedValue(new Blob(["a,b"], { type: "text/csv" }));
    apiRequest.mockImplementation((path: string) => {
      if (path === "/categories") return Promise.resolve(listMockCategories());
      if (path === "/imports") return Promise.resolve([...files]);
      if (path === "/imports/preview") return Promise.resolve(preview);
      if (path === "/imports/confirm") {
        files = [
          stored({ id: "bbbbbbbb-0000-4000-8000-000000000002", filename: "novo.csv" }),
          ...files,
        ];
        return Promise.resolve({ batchId: "b1", imported: 1, skipped: 2 });
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    });
  });

  const reimportButton = async () => screen.findByRole("button", { name: "Reimportar" });
  const currentStep = () => screen.getByRole("listitem", { current: "step" });

  it("mostra a seção Arquivos importados só no passo Conta e arquivo", async () => {
    renderPage();
    expect(await screen.findByText("extrato-marco.csv")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Arquivos importados" })).toBeInTheDocument();
    await goToPreview();
    expect(screen.queryByRole("heading", { name: "Arquivos importados" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reimportar" })).not.toBeInTheDocument();
  });

  it("Reimportar baixa o arquivo, envia o File original ao preview normal e leva ao passo Prévia", async () => {
    renderPage();
    fireEvent.click(await reimportButton());
    await screen.findByRole("button", { name: "Confirmar importação" });
    expect(apiRequestBlob).toHaveBeenCalledWith(
      "/imports/aaaaaaaa-0000-4000-8000-000000000001/file",
    );
    const body = bodyOf("/imports/preview");
    const sent = body.get("file") as File;
    expect(sent).toBeInstanceOf(File);
    expect(sent.name).toBe("extrato-marco.csv");
    expect(sent.type).toBe("text/csv");
    expect(body.get("accountId")).toBe("acc-1");
    expect(currentStep()).toHaveTextContent("2. Prévia");
    // Rows imported before come back as duplicates and start unselected; the default selection is unchanged.
    expect(screen.getByRole("checkbox", { name: "Selecionar Linha 1" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Selecionar Linha 0" })).toBeChecked();
    // Back at the start step the batch's account and file are filled in.
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByLabelText("Conta")).toHaveValue("acc-1");
    expect(screen.getByText("extrato-marco.csv", { selector: "p" })).toBeInTheDocument();
  });

  it("confirma o mesmo File pelo caminho normal com uma chave de idempotência nova a cada reimportação", async () => {
    renderPage();
    fireEvent.click(await reimportButton());
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar importação" }));
    await screen.findByRole("status");
    const confirmBody = bodyOf("/imports/confirm", 0);
    expect(confirmBody.get("file")).toBe(bodyOf("/imports/preview", 0).get("file"));
    expect(confirmBody.get("accountId")).toBe("acc-1");
    expect(JSON.parse(confirmBody.get("selections") as string)).toEqual([
      { index: 0, neutral: false, categoryId: UNCATEGORIZED },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Importar outro arquivo" }));
    fireEvent.click(await reimportButton());
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar importação" }));
    await waitFor(() => expect(callsTo("/imports/confirm")).toHaveLength(2));
    const first = confirmBody.get("idempotencyKey");
    const second = bodyOf("/imports/confirm", 1).get("idempotencyKey");
    expect(second).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).not.toBe(first);
  });

  it("aceita um arquivo guardado cujo nome não termina em .csv", async () => {
    files = [stored({ filename: "extrato-sem-extensao", mimeType: "application/octet-stream" })];
    renderPage();
    fireEvent.click(await reimportButton());
    await screen.findByRole("button", { name: "Confirmar importação" });
    const sent = bodyOf("/imports/preview").get("file") as File;
    expect(sent.name).toBe("extrato-sem-extensao");
  });

  it("falha no download mantém o passo inicial com o alerta da lista e não gera prévia", async () => {
    apiRequestBlob.mockRejectedValue(new ApiError("storage_error", "S3 exploded", 502));
    renderPage();
    fireEvent.click(await reimportButton());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Não foi possível acessar o arquivo guardado. Tente novamente.",
    );
    expect(alert).not.toHaveTextContent("S3 exploded");
    expect(callsTo("/imports/preview")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Gerar prévia" })).toBeInTheDocument();
    expect(currentStep()).toHaveTextContent("1. Conta e arquivo");
    expect(screen.getByRole("button", { name: "Reimportar" })).toBeEnabled();
  });

  it("falha no preview (conta inativa) mantém o passo inicial com conta e arquivo preenchidos e a mensagem no formulário", async () => {
    const base = apiRequest.getMockImplementation() as (path: string) => Promise<unknown>;
    apiRequest.mockImplementation((path: string) =>
      path === "/imports/preview"
        ? Promise.reject(new ApiError("invalid_account", "Select an active account", 422))
        : base(path),
    );
    renderPage();
    fireEvent.click(await reimportButton());
    expect(await screen.findByText("Selecione uma conta ativa")).toBeInTheDocument();
    expect(screen.getByLabelText("Conta")).toHaveValue("acc-1");
    expect(screen.getByText("extrato-marco.csv", { selector: "p" })).toBeInTheDocument();
    expect(currentStep()).toHaveTextContent("1. Conta e arquivo");
    expect(screen.queryByRole("button", { name: "Confirmar importação" })).not.toBeInTheDocument();
  });

  it("depois de confirmar com sucesso, voltar ao passo inicial mostra o novo lote", async () => {
    renderPage();
    await screen.findByText("extrato-marco.csv");
    expect(screen.queryByText("novo.csv")).not.toBeInTheDocument();
    await goToPreview();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar importação" }));
    await screen.findByRole("status");
    fireEvent.click(screen.getByRole("button", { name: "Importar outro arquivo" }));
    expect(await screen.findByText("novo.csv")).toBeInTheDocument();
    expect(screen.getByText("extrato-marco.csv")).toBeInTheDocument();
  });

  it("os botões da linha ficam desabilitados enquanto o arquivo é baixado para reimportar", async () => {
    let release: (blob: Blob) => void = () => {};
    apiRequestBlob.mockReturnValue(new Promise<Blob>((resolve) => (release = resolve)));
    renderPage();
    fireEvent.click(await reimportButton());
    await waitFor(() => expect(screen.getByRole("button", { name: "Reimportar" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Baixar" })).toBeDisabled();
    release(new Blob(["a,b"], { type: "text/csv" }));
    await screen.findByRole("button", { name: "Confirmar importação" });
    expect(callsTo("/imports/preview")).toHaveLength(1);
  });

  it("Reimportar com outra conta escolhida no formulário usa a conta do lote no preview e no confirm", async () => {
    renderPage();
    await screen.findByText("extrato-marco.csv");
    fireEvent.change(screen.getByLabelText("Conta"), { target: { value: "acc-2" } });
    fireEvent.click(await reimportButton());
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar importação" }));
    await screen.findByRole("status");
    expect(bodyOf("/imports/preview").get("accountId")).toBe("acc-1");
    expect(bodyOf("/imports/confirm").get("accountId")).toBe("acc-1");
  });

  it("duas reimportações seguidas sem confirmar geram duas prévias e a confirmação usa uma chave nova", async () => {
    const base = apiRequest.getMockImplementation() as (path: string) => Promise<unknown>;
    let failNext = true;
    apiRequest.mockImplementation((path: string) => {
      if (path === "/imports/confirm" && failNext) {
        failNext = false;
        return Promise.reject(new ApiError("storage_error", "x", 500));
      }
      return base(path);
    });
    renderPage();
    fireEvent.click(await reimportButton());
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar importação" }));
    await screen.findByText("Nada foi importado. Tente novamente.");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(await reimportButton());
    await waitFor(() => expect(callsTo("/imports/preview")).toHaveLength(2));
    expect(bodyOf("/imports/preview", 1).get("file")).not.toBe(
      bodyOf("/imports/preview", 0).get("file"),
    );
    expect(callsTo("/imports/confirm")).toHaveLength(1);
    expect(screen.queryByText("Nada foi importado. Tente novamente.")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar importação" }));
    await screen.findByRole("status");
    expect(callsTo("/imports/confirm")).toHaveLength(2);
    expect(bodyOf("/imports/confirm", 1).get("idempotencyKey")).not.toBe(
      bodyOf("/imports/confirm", 0).get("idempotencyKey"),
    );
    expect(bodyOf("/imports/confirm", 1).get("accountId")).toBe("acc-1");
  });

  it("Reimportar com todas as duplicadas marcadas abre o diálogo e, ao confirmar, cria um novo lote", async () => {
    const base = apiRequest.getMockImplementation() as (path: string) => Promise<unknown>;
    apiRequest.mockImplementation((path: string) =>
      path === "/imports/preview"
        ? Promise.resolve({
            rows: [row(0, "duplicate"), row(1, "duplicate"), row(2, "duplicate")],
            totals: { new: 0, duplicate: 3, ignored: 0, unrecognized: 0, invalid: 0 },
          })
        : base(path),
    );
    renderPage();
    fireEvent.click(await reimportButton());
    await screen.findByRole("button", { name: "Confirmar importação" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todas as linhas" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar importação" }));
    expect(
      await screen.findByText(/3 linhas selecionadas já foram importadas antes/),
    ).toBeInTheDocument();
    expect(callsTo("/imports/confirm")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Importar mesmo assim" }));
    await screen.findByRole("status");
    expect(callsTo("/imports/confirm")).toHaveLength(1);
    const confirmBody = bodyOf("/imports/confirm");
    expect(confirmBody.get("accountId")).toBe("acc-1");
    expect(JSON.parse(confirmBody.get("selections") as string)).toEqual([
      { index: 0, neutral: false, categoryId: UNCATEGORIZED },
      { index: 1, neutral: false, categoryId: UNCATEGORIZED },
      { index: 2, neutral: false, categoryId: UNCATEGORIZED },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Importar outro arquivo" }));
    expect(await screen.findByText("novo.csv")).toBeInTheDocument();
  });
});

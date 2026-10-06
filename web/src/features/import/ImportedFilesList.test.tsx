import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { GENERIC_ERROR } from "@/lib/api/errorMessages";
import type { ImportedFile } from "@/lib/api/types";
import { renderWithQuery } from "@/test/apiSpy";
import { ImportedFilesList } from "./ImportedFilesList";

const apiRequest = vi.hoisted(() => vi.fn());
const apiRequestBlob = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest,
  apiRequestBlob,
}));

const file = (over: Partial<ImportedFile> = {}): ImportedFile => ({
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  filename: "extrato-marco.csv",
  mimeType: "text/csv",
  sizeBytes: 100,
  bank: "Nubank",
  account: { id: "acc-1", nickname: "Nubank pessoal" },
  createdAt: "2026-03-05T12:00:00.000Z",
  rowCount: 4,
  importedCount: 3,
  skippedCount: 1,
  ...over,
});

const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();
let clicked: Array<{ download: string; href: string }>;

beforeEach(() => {
  apiRequest.mockReset();
  apiRequestBlob.mockReset();
  createObjectURL.mockReset().mockReturnValue("blob:mock-url");
  revokeObjectURL.mockReset();
  clicked = [];
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ download: this.download, href: this.href });
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderList = (props: Partial<Parameters<typeof ImportedFilesList>[0]> = {}) =>
  renderWithQuery(<ImportedFilesList onReimport={vi.fn()} {...props} />);

describe("lista de arquivos importados (IMPIMP-11)", () => {
  it("mostra nome, conta, data dd/mm/aaaa, contagens no singular e no plural e os dois botões", async () => {
    apiRequest.mockResolvedValue([
      file(),
      file({
        id: "aaaaaaaa-0000-4000-8000-000000000002",
        filename: "um.csv",
        importedCount: 1,
        skippedCount: 1,
        account: { id: "acc-2", nickname: "Nubank PJ" },
        createdAt: "2026-02-10T12:00:00.000Z",
      }),
    ]);
    renderList();
    const first = within((await screen.findByText("extrato-marco.csv")).closest("li")!);
    expect(screen.getByRole("heading", { name: "Arquivos importados" })).toBeInTheDocument();
    expect(first.getByText(/Nubank pessoal/)).toHaveTextContent("Nubank pessoal · 05/03/2026");
    expect(first.getByText("3 importadas · 1 ignorada")).toBeInTheDocument();
    expect(first.getByRole("button", { name: "Reimportar" })).toBeEnabled();
    expect(first.getByRole("button", { name: "Baixar" })).toBeEnabled();
    const second = within(screen.getByText("um.csv").closest("li")!);
    expect(second.getByText(/Nubank PJ/)).toHaveTextContent("Nubank PJ · 10/02/2026");
    expect(second.getByText("1 importada · 1 ignorada")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/imports");
  });

  it("mostra 3 linhas de skeleton enquanto carrega", () => {
    apiRequest.mockReturnValue(new Promise(() => {}));
    renderList();
    expect(screen.getAllByTestId("imported-file-skeleton")).toHaveLength(3);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sem lotes mostra o texto de vazio e nenhum botão", async () => {
    apiRequest.mockResolvedValue([]);
    renderList();
    expect(await screen.findByText("Nenhum arquivo importado ainda.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("imported-file-skeleton")).not.toBeInTheDocument();
  });

  it("erro de armazenamento na lista mostra a mensagem em português e Tentar novamente refaz a consulta", async () => {
    apiRequest.mockRejectedValueOnce(new ApiError("storage_error", "S3 exploded", 502));
    apiRequest.mockResolvedValue([file()]);
    renderList();
    const alert = await screen.findByText(
      "Não foi possível acessar o arquivo guardado. Tente novamente.",
    );
    expect(alert).toBeInTheDocument();
    expect(screen.queryByText("S3 exploded")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("extrato-marco.csv")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
  });

  it("erro inesperado na lista mostra o texto genérico, sem a mensagem da API", async () => {
    apiRequest.mockRejectedValue(new ApiError("internal_error", "stack trace", 500));
    renderList();
    expect(await screen.findByText(GENERIC_ERROR)).toBeInTheDocument();
    expect(screen.queryByText("stack trace")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});

describe("Baixar (IMPIMP-12)", () => {
  beforeEach(() => {
    apiRequest.mockResolvedValue([file()]);
  });

  it("baixa pelo cliente autenticado, salva com o nome original por uma URL de objeto e a revoga", async () => {
    const blob = new Blob(["a,b\n1,2\n"], { type: "text/csv" });
    apiRequestBlob.mockResolvedValue(blob);
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "Baixar" }));
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url"));
    expect(apiRequestBlob).toHaveBeenCalledTimes(1);
    expect(apiRequestBlob).toHaveBeenCalledWith(
      "/imports/aaaaaaaa-0000-4000-8000-000000000001/file",
    );
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual([{ download: "extrato-marco.csv", href: "blob:mock-url" }]);
    // The anchor is gone and the browser did not navigate away.
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("não coloca token nem caminho do Storage na requisição", async () => {
    apiRequestBlob.mockResolvedValue(new Blob(["x"]));
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "Baixar" }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    const [path, options] = apiRequestBlob.mock.calls[0] as [string, unknown];
    expect(path).toBe("/imports/aaaaaaaa-0000-4000-8000-000000000001/file");
    expect(path).not.toMatch(/token|apikey|storage|\?/i);
    expect(options).toBeUndefined();
  });

  it("desabilita os botões da linha enquanto o download roda e os reabilita depois", async () => {
    let release: (blob: Blob) => void = () => {};
    apiRequestBlob.mockReturnValue(new Promise<Blob>((resolve) => (release = resolve)));
    apiRequest.mockResolvedValue([
      file(),
      file({ id: "aaaaaaaa-0000-4000-8000-000000000002", filename: "outro.csv" }),
    ]);
    renderList();
    const row = within((await screen.findByText("extrato-marco.csv")).closest("li")!);
    fireEvent.click(row.getByRole("button", { name: "Baixar" }));
    await waitFor(() => expect(row.getByRole("button", { name: "Baixar" })).toBeDisabled());
    expect(row.getByRole("button", { name: "Reimportar" })).toBeDisabled();
    const other = within(screen.getByText("outro.csv").closest("li")!);
    expect(other.getByRole("button", { name: "Baixar" })).toBeEnabled();
    release(new Blob(["x"]));
    await waitFor(() => expect(row.getByRole("button", { name: "Baixar" })).toBeEnabled());
    expect(row.getByRole("button", { name: "Reimportar" })).toBeEnabled();
  });

  it("falha do download mostra o alerta em português, sem texto da API, e não salva nada", async () => {
    apiRequestBlob.mockRejectedValue(new ApiError("storage_error", "S3 exploded", 502));
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "Baixar" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Não foi possível acessar o arquivo guardado. Tente novamente.",
    );
    expect(alert).not.toHaveTextContent("S3 exploded");
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Baixar" })).toBeEnabled();
  });

  it("arquivo ausente do armazenamento mostra a mensagem de não encontrado", async () => {
    apiRequestBlob.mockRejectedValue(new ApiError("not_found", "Import not found", 404));
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "Baixar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Registro não encontrado. Atualize a página e tente de novo",
    );
  });
});

describe("Reimportar na lista (IMPIMP-13)", () => {
  it("chama onReimport com o arquivo da linha", async () => {
    apiRequest.mockResolvedValue([file()]);
    const onReimport = vi.fn();
    renderList({ onReimport });
    fireEvent.click(await screen.findByRole("button", { name: "Reimportar" }));
    expect(onReimport).toHaveBeenCalledWith(file());
  });

  it("desabilita os botões da linha que está sendo reimportada", async () => {
    apiRequest.mockResolvedValue([file()]);
    renderList({ reimportingId: file().id });
    expect(await screen.findByRole("button", { name: "Reimportar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Baixar" })).toBeDisabled();
  });

  it("mostra o erro da reimportação em um alerta em português", async () => {
    apiRequest.mockResolvedValue([file()]);
    renderList({ reimportError: new ApiError("storage_not_configured", "no key", 503) });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O armazenamento de arquivos não está disponível no momento.",
    );
  });
});

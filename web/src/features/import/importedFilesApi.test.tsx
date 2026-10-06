import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { ImportedFile } from "@/lib/api/types";
import { downloadImportFile, fileFromBlob, listImports } from "./api";
import {
  useDownloadImport,
  useImportConfirm,
  useImportedFiles,
  useReimportFile,
} from "./useImport";

const apiRequest = vi.hoisted(() => vi.fn());
const apiRequestBlob = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest,
  apiRequestBlob,
}));

const imported: ImportedFile = {
  id: "11111111-1111-4111-8111-aaaaaaaaaaaa",
  filename: "extrato março.csv",
  mimeType: "text/csv",
  sizeBytes: 12,
  bank: "Nubank",
  account: { id: "11111111-1111-4111-8111-111111111111", nickname: "Nubank pessoal" },
  createdAt: "2026-03-05T12:00:00.000Z",
  rowCount: 3,
  importedCount: 2,
  skippedCount: 1,
};

/** jsdom's Blob and File have no `text()`. */
const readText = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  apiRequest.mockReset();
  apiRequestBlob.mockReset();
});
afterEach(cleanup);

describe("camada de dados dos arquivos importados (IMPIMP-11, IMPIMP-12, IMPIMP-13)", () => {
  it("listImports chama GET /imports", async () => {
    apiRequest.mockResolvedValue([imported]);
    await expect(listImports()).resolves.toEqual([imported]);
    expect(apiRequest).toHaveBeenCalledWith("/imports");
  });

  it("downloadImportFile chama GET /imports/:id/file pelo cliente de Blob autenticado", async () => {
    const blob = new Blob(["a,b"]);
    apiRequestBlob.mockResolvedValue(blob);
    await expect(downloadImportFile(imported.id)).resolves.toBe(blob);
    expect(apiRequestBlob).toHaveBeenCalledWith(`/imports/${imported.id}/file`);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("fileFromBlob devolve um File com o nome e o tipo originais e os bytes do Blob", async () => {
    const file = fileFromBlob(new Blob(["a,b\n1,2\n"]), imported);
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("extrato março.csv");
    expect(file.type).toBe("text/csv");
    expect(await readText(file)).toBe("a,b\n1,2\n");
  });

  it("useImportedFiles carrega a lista sob a chave [imports]", async () => {
    apiRequest.mockResolvedValue([imported]);
    const { wrapper, client } = setup();
    const { result } = renderHook(() => useImportedFiles(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([imported]));
    expect(client.getQueryData(["imports"])).toEqual([imported]);
  });

  it("uma confirmação com sucesso invalida [imports] e [transactions]", async () => {
    apiRequest.mockResolvedValue({ batchId: "b", imported: 1, skipped: 0 });
    const { wrapper, client } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useImportConfirm(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        file: new File(["a"], "a.csv"),
        accountId: imported.account.id,
        idempotencyKey: "k",
        selections: [],
      }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["imports"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["transactions"] });
  });

  it("uma confirmação com falha não invalida [imports]", async () => {
    apiRequest.mockRejectedValue(new ApiError("internal_error", "x", 500));
    const { wrapper, client } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useImportConfirm(), { wrapper });
    act(() => {
      result.current.mutate({
        file: new File(["a"], "a.csv"),
        accountId: imported.account.id,
        idempotencyKey: "k",
        selections: [],
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ["imports"] });
  });

  it("useDownloadImport devolve o Blob do arquivo do lote", async () => {
    const blob = new Blob(["x"]);
    apiRequestBlob.mockResolvedValue(blob);
    const { wrapper } = setup();
    const { result } = renderHook(() => useDownloadImport(), { wrapper });
    await expect(act(() => result.current.mutateAsync(imported))).resolves.toBe(blob);
    expect(apiRequestBlob).toHaveBeenCalledWith(`/imports/${imported.id}/file`);
  });

  it("useReimportFile devolve o File montado com o nome e o tipo do lote", async () => {
    apiRequestBlob.mockResolvedValue(new Blob(["a,b"]));
    const { wrapper } = setup();
    const { result } = renderHook(() => useReimportFile(), { wrapper });
    const file = await act(() => result.current.mutateAsync(imported));
    expect(file.name).toBe("extrato março.csv");
    expect(file.type).toBe("text/csv");
    expect(await readText(file)).toBe("a,b");
  });

  it("useReimportFile propaga a falha do download", async () => {
    apiRequestBlob.mockRejectedValue(new ApiError("storage_error", "x", 502));
    const { wrapper } = setup();
    const { result } = renderHook(() => useReimportFile(), { wrapper });
    act(() => result.current.mutate(imported));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: "storage_error" });
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { importErrorMessage } from "./errorMessages";
import { useIdempotencyKey, useImportConfirm, useImportPreview } from "./useImport";

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest,
}));

const file = new File(["a,b"], "extrato.csv", { type: "text/csv" });
const accountId = "11111111-1111-4111-8111-111111111111";

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
});
afterEach(cleanup);

describe("hooks de importação", () => {
  it("a prévia envia o arquivo e a conta como multipart", async () => {
    apiRequest.mockResolvedValue({ rows: [], totals: {} });
    const { wrapper } = setup();
    const { result } = renderHook(() => useImportPreview(), { wrapper });
    await act(() => result.current.mutateAsync({ file, accountId }));
    const [path, options] = apiRequest.mock.calls[0] as [
      string,
      { method: string; body: FormData },
    ];
    expect(path).toBe("/imports/preview");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("file")).toBe(file);
    expect(options.body.get("accountId")).toBe(accountId);
  });

  it("a confirmação envia o mesmo arquivo, a chave e só as seleções", async () => {
    apiRequest.mockResolvedValue({ batchId: "b", imported: 1, skipped: 0 });
    const { wrapper, client } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useImportConfirm(), { wrapper });
    const selections = [{ index: 3, neutral: true }];
    await act(() =>
      result.current.mutateAsync({ file, accountId, idempotencyKey: "key-1", selections }),
    );
    const [path, options] = apiRequest.mock.calls[0] as [string, { body: FormData }];
    expect(path).toBe("/imports/confirm");
    expect(options.body.get("file")).toBe(file);
    expect(options.body.get("accountId")).toBe(accountId);
    expect(options.body.get("idempotencyKey")).toBe("key-1");
    expect(JSON.parse(options.body.get("selections") as string)).toEqual(selections);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["transactions"] }));
  });

  it("não invalida o extrato quando a confirmação falha", async () => {
    apiRequest.mockImplementation(async () => {
      throw new ApiError("internal_error", "x", 500);
    });
    const { wrapper, client } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useImportConfirm(), { wrapper });
    act(() => {
      result.current.mutate({ file, accountId, idempotencyKey: "k", selections: [] });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("mantém a chave estável entre renderizações e a troca só ao renovar", () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey());
    const first = result.current.key;
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    rerender();
    expect(result.current.key).toBe(first);
    let renewed = "";
    act(() => {
      renewed = result.current.renew();
    });
    expect(result.current.key).toBe(renewed);
    expect(renewed).not.toBe(first);
  });
});

describe("importErrorMessage", () => {
  it.each([
    ["unsupported_format", "Formato de arquivo não reconhecido"],
    ["bank_mismatch", "Formato incompatível com a conta selecionada"],
    ["empty_file", "O arquivo não tem linhas"],
    ["file_too_large", "Arquivo excede 5 MB"],
    ["invalid_account", "Selecione uma conta ativa"],
    ["invalid_selection", "Há linhas selecionadas que não podem ser importadas"],
    ["validation_error", "Dados inválidos. Revise o arquivo e a conta"],
    ["invalid_category", "Há linhas com categoria inválida. Gere a prévia de novo."],
    ["storage_error", "Não foi possível acessar o arquivo guardado. Tente novamente."],
    ["storage_not_configured", "O armazenamento de arquivos não está disponível no momento."],
    ["internal_error", "Não foi possível concluir a importação. Tente novamente."],
    ["something_new", "Não foi possível concluir a importação. Tente novamente."],
  ])("traduz o código %s sem exibir a mensagem em inglês", (code, expected) => {
    expect(importErrorMessage(new ApiError(code, "English message", 422))).toBe(expected);
  });

  it("usa a mensagem genérica para falha de rede e erros que não são da API", () => {
    const generic = "Não foi possível concluir a importação. Tente novamente.";
    expect(importErrorMessage(new TypeError("Failed to fetch"))).toBe(generic);
    expect(importErrorMessage("boom")).toBe(generic);
    expect(importErrorMessage(undefined)).toBe(generic);
  });
});

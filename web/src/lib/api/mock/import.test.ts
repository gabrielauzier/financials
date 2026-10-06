import { afterEach, describe, expect, it, vi } from "vitest";
import { paymentMethodLabels } from "@/features/transactions/labels";
import { apiRequestBlob } from "../client";
import type {
  Category,
  ImportConfirmResult,
  ImportedFile,
  ImportPreview,
  ImportSelection,
} from "../types";
import { areaFromPath, mockRequest, shouldMock } from "./index";

afterEach(() => vi.unstubAllEnvs());

const HEADER = "Data,Valor,Identificador,Descrição";
const accounts = () =>
  mockRequest<Array<{ id: string; nickname: string }>>({ method: "GET", path: "/accounts" });
const list = () => mockRequest<ImportedFile[]>({ method: "GET", path: "/imports" });

const form = (content: string, accountId: string, extra: Record<string, string> = {}) => {
  const body = new FormData();
  body.append("file", new File([content], "novo.csv", { type: "text/csv" }));
  body.append("accountId", accountId);
  for (const [key, value] of Object.entries(extra)) body.append(key, value);
  return body;
};
const unique = () => crypto.randomUUID();
const csv = (...lines: string[]) => [HEADER, ...lines].join("\n");

const preview = async (content: string) => {
  const [account] = await accounts();
  return mockRequest<ImportPreview>({
    method: "POST",
    path: "/imports/preview",
    body: form(content, account?.id ?? ""),
  });
};
const confirm = async (
  content: string,
  selections: ImportSelection[],
  key = unique(),
): Promise<ImportConfirmResult> => {
  const [account] = await accounts();
  return mockRequest<ImportConfirmResult>({
    method: "POST",
    path: "/imports/confirm",
    body: form(content, account?.id ?? "", {
      idempotencyKey: key,
      selections: JSON.stringify(selections),
    }),
  });
};

describe("chave de área do import (IMPIMP-14)", () => {
  it("o caminho /imports e /imports/... pertence à área imports", () => {
    expect(areaFromPath("/imports")).toBe("imports");
    expect(areaFromPath("/imports/preview")).toBe("imports");
    expect(areaFromPath("/imports/abc/file")).toBe("imports");
  });

  it("com VITE_MOCK_AREAS=imports só as rotas de import são simuladas", () => {
    vi.stubEnv("VITE_MOCK_AREAS", "imports");
    expect(shouldMock("/imports/preview")).toBe(true);
    expect(shouldMock("/imports")).toBe(true);
    expect(shouldMock("/accounts")).toBe(false);
  });
});

describe("GET /imports no mock (IMPIMP-14)", () => {
  it("devolve os lotes semeados do mais novo para o mais antigo, no formato ImportedFile", async () => {
    const files = await list();
    expect(files.length).toBeGreaterThanOrEqual(2);
    const dates = files.map((file) => file.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
    const known = await accounts();
    for (const file of files) {
      expect(Object.keys(file).sort()).toEqual(
        [
          "account",
          "bank",
          "createdAt",
          "filename",
          "id",
          "importedCount",
          "mimeType",
          "rowCount",
          "sizeBytes",
          "skippedCount",
        ].sort(),
      );
      expect(known.find((account) => account.id === file.account.id)?.nickname).toBe(
        file.account.nickname,
      );
      expect(file.rowCount).toBe(file.importedCount + file.skippedCount);
    }
  });

  it("respeita o limit", async () => {
    const files = await mockRequest<ImportedFile[]>({ method: "GET", path: "/imports?limit=1" });
    expect(files).toHaveLength(1);
  });

  it("um confirm cria um lote novo que a próxima listagem devolve primeiro", async () => {
    const before = await list();
    const result = await confirm(
      csv("01/04/2026,-10.00,99999999-0000-4000-8000-000000000001,Compra no débito - Loja"),
      [{ index: 0, neutral: false }],
    );
    const after = await list();
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toMatchObject({
      id: result.batchId,
      filename: "novo.csv",
      mimeType: "text/csv",
      rowCount: 1,
      importedCount: 1,
      skippedCount: 0,
    });
  });
});

describe("GET /imports/:id/file no mock", () => {
  it("devolve um Blob com o texto do CSV do lote", async () => {
    const [first] = await list();
    const blob = await mockRequest<Blob>({ method: "GET", path: `/imports/${first?.id}/file` });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("text/csv");
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    expect(text.startsWith(HEADER)).toBe(true);
  });

  it("o cliente de Blob em modo mock devolve o Blob do handler", async () => {
    const [first] = await list();
    const blob = await apiRequestBlob(`/imports/${first?.id}/file`);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("um id desconhecido dá not_found 404", async () => {
    await expect(
      mockRequest({ method: "GET", path: `/imports/${unique()}/file` }),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
  });
});

describe("POST /imports/preview no mock", () => {
  it("devolve linhas com categoryId de categorias do mock e métodos com rótulo", async () => {
    const result = await preview(
      csv(
        "01/04/2026,-10.00,88888888-0000-4000-8000-000000000001,Compra no débito - Mercado Azul",
        "02/04/2026,500.00,88888888-0000-4000-8000-000000000002,Transferência recebida - Empresa X",
      ),
    );
    const categories = await mockRequest<Category[]>({ method: "GET", path: "/categories" });
    expect(result.rows).toHaveLength(2);
    for (const row of result.rows) {
      const category = categories.find((item) => item.id === row.categoryId);
      expect(category?.name).toBe(row.categoryName);
      expect(Object.keys(paymentMethodLabels)).toContain(row.paymentMethod);
    }
    expect(result.rows[0]).toMatchObject({
      type: "Expense",
      amount: "10.00",
      localDate: "2026-04-01",
    });
    expect(result.rows[1]).toMatchObject({ type: "Income", amount: "500.00" });
    expect(result.totals).toEqual({
      new: 2,
      duplicate: 0,
      ignored: 0,
      unrecognized: 0,
      invalid: 0,
    });
  });

  it("marca como duplicate as linhas de um arquivo igual a um lote semeado", async () => {
    const [first] = await list();
    const blob = await mockRequest<Blob>({ method: "GET", path: `/imports/${first?.id}/file` });
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    const result = await preview(text);
    expect(result.rows.length).toBe(first?.rowCount);
    expect(
      result.rows.slice(0, first?.importedCount).every((row) => row.status === "duplicate"),
    ).toBe(true);
    expect(result.totals.duplicate).toBe(first?.importedCount);
  });

  it("recusa conta inativa ou ausente, formato desconhecido e arquivo vazio com os códigos da API", async () => {
    await expect(
      mockRequest({ method: "POST", path: "/imports/preview", body: form(csv("x"), unique()) }),
    ).rejects.toMatchObject({ code: "invalid_account", status: 422 });
    await expect(preview("a,b\n1,2")).rejects.toMatchObject({ code: "unsupported_format" });
    await expect(preview(HEADER)).rejects.toMatchObject({ code: "empty_file" });
  });

  it("marca como inválida uma linha com data ou valor ruim", async () => {
    const result = await preview(
      csv("31-13-2026,-10.00,77777777-0000-4000-8000-000000000001,Compra - A"),
    );
    expect(result.rows[0]?.status).toBe("invalid");
    expect(result.totals.invalid).toBe(1);
  });
});

describe("POST /imports/confirm no mock", () => {
  const two = csv(
    "01/05/2026,-10.00,66666666-0000-4000-8000-000000000001,Compra no débito - Loja A",
    "02/05/2026,-20.00,66666666-0000-4000-8000-000000000002,Compra no débito - Loja B",
  );

  it("conta importadas e ignoradas conforme as seleções", async () => {
    const result = await confirm(two, [{ index: 1, neutral: true }]);
    expect(result).toMatchObject({ imported: 1, skipped: 1 });
    expect(result.batchId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("aceita uma categoryId de categoria do mock", async () => {
    const [category] = await mockRequest<Category[]>({ method: "GET", path: "/categories" });
    const result = await confirm(
      csv("01/06/2026,-10.00,55555555-0000-4000-8000-000000000001,Compra - Loja C"),
      [{ index: 0, neutral: false, categoryId: category?.id ?? "" }],
    );
    expect(result.imported).toBe(1);
  });

  it("rejeita uma categoryId desconhecida com invalid_category 422 e não cria lote", async () => {
    const before = await list();
    await expect(
      confirm(two, [{ index: 0, neutral: false, categoryId: unique() }]),
    ).rejects.toMatchObject({ code: "invalid_category", status: 422, field: "selections" });
    expect(await list()).toHaveLength(before.length);
  });

  it("rejeita a seleção de uma linha inválida com invalid_selection", async () => {
    await expect(
      confirm(csv("xx,-10.00,44444444-0000-4000-8000-000000000001,Compra - D"), [
        { index: 0, neutral: false },
      ]),
    ).rejects.toMatchObject({ code: "invalid_selection", status: 422 });
  });

  it("a mesma chave de idempotência devolve o mesmo resumo sem criar outro lote", async () => {
    const key = unique();
    const first = await confirm(two, [{ index: 0, neutral: false }], key);
    const count = (await list()).length;
    const second = await confirm(two, [{ index: 0, neutral: false }], key);
    expect(second).toEqual(first);
    expect(await list()).toHaveLength(count);
  });

  it("depois do confirm, o mesmo arquivo vira duplicado no preview", async () => {
    const content = csv(
      "01/07/2026,-10.00,33333333-0000-4000-8000-000000000001,Compra no débito - Loja E",
    );
    await confirm(content, [{ index: 0, neutral: false }]);
    expect((await preview(content)).rows[0]?.status).toBe("duplicate");
  });
});

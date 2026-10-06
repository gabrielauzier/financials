import { describe, expect, it } from "vitest";
import { ApiError } from "./client";
import { fieldForError, GENERIC_ERROR, messageForError } from "./errorMessages";

const api = (code: string, field?: string) =>
  new ApiError(code, "Technical English text", 422, field);

describe("messageForError", () => {
  it("uses the context for duplicate_name", () => {
    expect(messageForError(api("duplicate_name"), "account")).toBe(
      "Já existe uma conta com esse apelido",
    );
    expect(messageForError(api("duplicate_name"), "category")).toBe(
      "Já existe uma categoria com esse nome",
    );
    expect(messageForError(api("duplicate_name"), "transaction")).toBe(GENERIC_ERROR);
    expect(messageForError(api("duplicate_name"))).toBe(GENERIC_ERROR);
  });

  it.each([
    ["holder_required", "Informe ao menos um titular"],
    ["category_protected", "Categoria protegida"],
    ["reassign_required", "Escolha a categoria de destino"],
    ["invalid_amount", "Valor inválido"],
    ["invalid_account", "Selecione uma conta ativa"],
    ["invalid_receipt_url", "URL inválida"],
    ["not_found", "Registro não encontrado. Atualize a página e tente de novo"],
    ["validation_error", "Dados inválidos. Revise os campos"],
    ["unauthorized", "Sua sessão expirou. Entre novamente"],
    ["storage_error", "Não foi possível acessar o arquivo guardado. Tente novamente."],
    ["storage_not_configured", "O armazenamento de arquivos não está disponível no momento."],
  ])("maps %s to its Portuguese text", (code, text) => {
    expect(messageForError(api(code), "transaction")).toBe(text);
  });

  it.each([
    ["invalid_paid_amount", "Valor pago inválido"],
    ["invalid_day", "Dia inválido (use de 1 a 31)"],
    ["invalid_status", "Status inválido"],
  ])("maps the credit expense code %s to its Portuguese text", (code, text) => {
    expect(messageForError(api(code), "creditExpense")).toBe(text);
  });

  it.each([
    ["invalid_period", "Período inválido"],
    ["invalid_date", "Data inválida"],
    ["invalid_amount", "Valor inválido"],
  ])(
    "maps the dashboard code %s to its Portuguese text in the investmentReturn context",
    (code, text) => {
      expect(messageForError(api(code), "investmentReturn")).toBe(text);
      expect(messageForError(api(code))).toBe(text);
    },
  );

  it("explains invalid_account as a valid account (inactive ones are allowed) for investment returns", () => {
    expect(messageForError(api("invalid_account"), "investmentReturn")).toBe(
      "Selecione uma conta válida",
    );
    expect(messageForError(api("invalid_account"), "creditExpense")).toBe(
      "Selecione uma conta ativa",
    );
  });

  it("keeps generic codes in the investmentReturn context without leaking the API message", () => {
    expect(messageForError(api("not_found"), "investmentReturn")).toBe(
      "Registro não encontrado. Atualize a página e tente de novo",
    );
    expect(messageForError(api("invalid_period"), "investmentReturn")).not.toContain(
      "Technical English",
    );
  });

  it("reads invalid_amount as the total only in the creditExpense context", () => {
    expect(messageForError(api("invalid_amount"), "creditExpense")).toBe("Valor total inválido");
    expect(messageForError(api("invalid_amount"), "transaction")).toBe("Valor inválido");
    expect(messageForError(api("invalid_amount"))).toBe("Valor inválido");
  });

  it("keeps generic codes unchanged in the creditExpense context without leaking the API message", () => {
    expect(messageForError(api("not_found"), "creditExpense")).toBe(
      "Registro não encontrado. Atualize a página e tente de novo",
    );
    expect(messageForError(api("duplicate_name"), "creditExpense")).toBe(GENERIC_ERROR);
    expect(messageForError(api("invalid_day"), "creditExpense")).not.toContain("Technical English");
  });

  it("returns the generic text for unknown codes, TypeError and non-error values", () => {
    expect(messageForError(api("something_new"))).toBe(GENERIC_ERROR);
    expect(messageForError(new TypeError("Failed to fetch"))).toBe(GENERIC_ERROR);
    expect(messageForError("boom")).toBe(GENERIC_ERROR);
    expect(messageForError(undefined)).toBe(GENERIC_ERROR);
  });

  it("also understands in-memory mock errors that carry a code", () => {
    const mockError = Object.assign(new Error("Já existe uma conta com esse apelido"), {
      code: "duplicate_name",
    });
    expect(messageForError(mockError, "account")).toBe("Já existe uma conta com esse apelido");
    expect(messageForError(Object.assign(new Error("English"), { code: "ECONNREFUSED" }))).toBe(
      GENERIC_ERROR,
    );
  });

  it("never includes the API message", () => {
    for (const code of ["duplicate_name", "not_found", "unknown_code", "internal_error"]) {
      expect(messageForError(api(code), "account")).not.toContain("Technical English");
    }
  });
});

describe("fieldForError", () => {
  it("returns the API field", () => {
    expect(fieldForError(api("invalid_amount", "amount"))).toBe("amount");
  });

  it("returns undefined without a field or for other values", () => {
    expect(fieldForError(api("not_found"))).toBeUndefined();
    expect(fieldForError(new Error("x"))).toBeUndefined();
    expect(fieldForError(null)).toBeUndefined();
  });
});

describe("messageForError no contexto de importação (IMPIMP-15)", () => {
  it.each([
    ["storage_error", "Não foi possível acessar o arquivo guardado. Tente novamente."],
    ["storage_not_configured", "O armazenamento de arquivos não está disponível no momento."],
  ])("traduz %s sem cair no texto genérico nem expor a mensagem da API", (code, text) => {
    const message = messageForError(api(code), "import");
    expect(message).toBe(text);
    expect(message).not.toBe(GENERIC_ERROR);
    expect(message).not.toContain("Technical English");
  });
});

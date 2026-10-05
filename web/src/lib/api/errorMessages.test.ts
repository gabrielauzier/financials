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
  ])("maps %s to its Portuguese text", (code, text) => {
    expect(messageForError(api(code), "transaction")).toBe(text);
  });

  it("returns the generic text for unknown codes, TypeError and non-error values", () => {
    expect(messageForError(api("something_new"))).toBe(GENERIC_ERROR);
    expect(messageForError(new TypeError("Failed to fetch"))).toBe(GENERIC_ERROR);
    expect(messageForError("boom")).toBe(GENERIC_ERROR);
    expect(messageForError(undefined)).toBe(GENERIC_ERROR);
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

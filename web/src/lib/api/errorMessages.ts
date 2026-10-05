export type ErrorContext = "account" | "category" | "transaction" | "import";

export const GENERIC_ERROR = "Não foi possível concluir a operação. Tente novamente.";

const messages: Record<string, string> = {
  holder_required: "Informe ao menos um titular",
  category_protected: "Categoria protegida",
  reassign_required: "Escolha a categoria de destino",
  invalid_amount: "Valor inválido",
  invalid_account: "Selecione uma conta ativa",
  invalid_receipt_url: "URL inválida",
  not_found: "Registro não encontrado. Atualize a página e tente de novo",
  validation_error: "Dados inválidos. Revise os campos",
  unauthorized: "Sua sessão expirou. Entre novamente",
};

const duplicateNameMessages: Partial<Record<ErrorContext, string>> = {
  account: "Já existe uma conta com esse apelido",
  category: "Já existe uma categoria com esse nome",
};

// Duck-typed on `code`/`field` so both ApiError and the in-memory mock errors are understood.
const codeOf = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;

/** Maps an API error to a Portuguese message. Never returns the API `message`. */
export function messageForError(error: unknown, context?: ErrorContext): string {
  const code = codeOf(error);
  if (code === undefined) return GENERIC_ERROR;
  if (code === "duplicate_name") {
    return (context && duplicateNameMessages[context]) ?? GENERIC_ERROR;
  }
  return messages[code] ?? GENERIC_ERROR;
}

export function fieldForError(error: unknown): string | undefined {
  if (codeOf(error) === undefined) return undefined;
  const field = (error as { field?: unknown }).field;
  return typeof field === "string" ? field : undefined;
}

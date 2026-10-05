import { ApiError } from "@/lib/api/client";
import { messageForError } from "@/lib/api/errorMessages";

export const GENERIC_IMPORT_ERROR = "Não foi possível concluir a importação. Tente novamente.";

const messages: Record<string, string> = {
  unsupported_format: "Formato de arquivo não reconhecido",
  bank_mismatch: "Formato incompatível com a conta selecionada",
  empty_file: "O arquivo não tem linhas",
  file_too_large: "Arquivo excede 5 MB",
  invalid_selection: "Há linhas selecionadas que não podem ser importadas",
  validation_error: "Dados inválidos. Revise o arquivo e a conta",
};

const sharedCodes = new Set(["invalid_account"]);

export function importErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC_IMPORT_ERROR;
  if (sharedCodes.has(error.code)) return messageForError(error, "import");
  return messages[error.code] ?? GENERIC_IMPORT_ERROR;
}

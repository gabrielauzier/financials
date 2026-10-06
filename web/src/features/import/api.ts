import { apiRequest, apiRequestBlob } from "@/lib/api/client";
import type {
  ImportConfirmResult,
  ImportedFile,
  ImportPreview,
  ImportSelection,
} from "@/lib/api/types";

export type PreviewInput = { file: File; accountId: string };
export type ConfirmInput = PreviewInput & {
  idempotencyKey: string;
  selections: ImportSelection[];
};

export const previewImport = ({ file, accountId }: PreviewInput) => {
  const body = new FormData();
  body.append("file", file);
  body.append("accountId", accountId);
  return apiRequest<ImportPreview>("/imports/preview", { method: "POST", body });
};

export const confirmImport = ({ file, accountId, idempotencyKey, selections }: ConfirmInput) => {
  const body = new FormData();
  body.append("file", file);
  body.append("accountId", accountId);
  body.append("idempotencyKey", idempotencyKey);
  body.append("selections", JSON.stringify(selections));
  return apiRequest<ImportConfirmResult>("/imports/confirm", { method: "POST", body });
};

export const listImports = (limit?: number) =>
  apiRequest<ImportedFile[]>(limit === undefined ? "/imports" : `/imports?limit=${limit}`);

export const downloadImportFile = (id: string) => apiRequestBlob(`/imports/${id}/file`);

/** The stored file as a `File` with its original name and type, ready for the normal preview. */
export const fileFromBlob = (blob: Blob, file: ImportedFile) =>
  new File([blob], file.filename, { type: file.mimeType });

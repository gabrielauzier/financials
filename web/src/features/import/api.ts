import { apiRequest } from "@/lib/api/client";
import type { ImportConfirmResult, ImportPreview, ImportSelection } from "@/lib/api/types";

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

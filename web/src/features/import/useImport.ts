import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { confirmImport, downloadImportFile, fileFromBlob, listImports, previewImport } from "./api";
import type { ImportedFile } from "@/lib/api/types";

export const useImportPreview = () => useMutation({ mutationFn: previewImport });

export function useImportConfirm() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: confirmImport,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["transactions"] }),
        client.invalidateQueries({ queryKey: ["imports"] }),
      ]),
  });
}

export const useImportedFiles = () =>
  useQuery({ queryKey: ["imports"], queryFn: () => listImports() });

/** Downloads the stored file as a `Blob` (authenticated, never through a URL with a token). */
export const useDownloadImport = () =>
  useMutation({ mutationFn: (file: ImportedFile) => downloadImportFile(file.id) });

/** Downloads the stored file and rebuilds it as a `File` to feed the normal preview. */
export const useReimportFile = () =>
  useMutation({
    mutationFn: async (file: ImportedFile) => fileFromBlob(await downloadImportFile(file.id), file),
  });

/**
 * Idempotency key of one preview session: stable across re-renders and retries,
 * replaced only by `renew()` (called when a new preview session starts).
 */
export function useIdempotencyKey() {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const renew = useCallback(() => {
    const next = crypto.randomUUID();
    setKey(next);
    return next;
  }, []);
  return { key, renew };
}

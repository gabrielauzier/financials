import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { confirmImport, previewImport } from "./api";

export const useImportPreview = () => useMutation({ mutationFn: previewImport });

export function useImportConfirm() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: confirmImport,
    onSuccess: () => client.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

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

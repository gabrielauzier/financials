import { Link } from "@tanstack/react-router";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ImportConfirmResult } from "@/lib/api/types";
import { importErrorMessage } from "./errorMessages";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function ImportSuccess({
  result,
  onImportAnother,
}: {
  result: ImportConfirmResult;
  onImportAnother: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h2 className="text-xl font-semibold" role="status">
        {plural(result.imported, "transação importada", "transações importadas")},{" "}
        {plural(result.skipped, "ignorada", "ignoradas")}
      </h2>
      <div className="flex gap-3">
        <Button asChild>
          <Link to="/extrato">Ver extrato</Link>
        </Button>
        <Button type="button" variant="outline" onClick={onImportAnother}>
          Importar outro arquivo
        </Button>
      </div>
    </div>
  );
}

/** Shown above the preview, which stays on screen; retrying reuses the session idempotency key. */
export function ImportFailure({
  error,
  onRetry,
  isRetrying = false,
}: {
  error: unknown;
  onRetry: () => void;
  isRetrying?: boolean;
}) {
  return (
    <Alert variant="destructive" className="flex flex-col items-start gap-2">
      <p className="font-medium">Nada foi importado. Tente novamente.</p>
      <p>{importErrorMessage(error)}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
        Tentar novamente
      </Button>
    </Alert>
  );
}

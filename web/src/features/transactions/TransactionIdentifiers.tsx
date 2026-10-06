import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/notify";

/** Copies `text`; without `navigator.clipboard` (no secure context) or on a refused write, the error toast shows. */
async function copyText(text: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    notifySuccess(successMessage);
  } catch (reason) {
    notifyError(reason);
  }
}

type RowProps = {
  label: string;
  value: string | null;
  testId: string;
  copyLabel: string;
  copiedMessage: string;
};
function IdentifierRow({ label, value, testId, copyLabel, copiedMessage }: RowProps) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1">
        <span data-testid={testId} className="break-all font-mono text-xs">
          {value ?? "—"}
        </span>
        {value !== null && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label={copyLabel}
            onClick={() => void copyText(value, copiedMessage)}
          >
            <Copy className="size-3.5" />
          </Button>
        )}
      </dd>
    </div>
  );
}

/** Read-only identifiers of a saved transaction: the database id and the external identifier (set by the import). */
export function TransactionIdentifiers({
  id,
  identifier,
}: {
  id: string;
  identifier: string | null;
}) {
  return (
    <div
      role="group"
      aria-label="Identificadores da transação"
      className="rounded-md border bg-muted/40 px-3 py-2"
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        <IdentifierRow
          label="ID"
          value={id}
          testId="transaction-id"
          copyLabel="Copiar ID"
          copiedMessage="ID copiado"
        />
        <IdentifierRow
          label="Identificador externo"
          value={identifier}
          testId="transaction-identifier"
          copyLabel="Copiar identificador externo"
          copiedMessage="Identificador externo copiado"
        />
      </dl>
    </div>
  );
}

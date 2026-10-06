import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ImportConfirmResult, ImportPreview } from "@/lib/api/types";
import { DuplicateConfirmDialog } from "./DuplicateConfirmDialog";
import { ImportPreviewTable } from "./ImportPreviewTable";
import { ImportStartStep } from "./ImportStartStep";
import { ImportFailure, ImportSuccess } from "./ImportSummary";
import {
  initialSelection,
  selectedDuplicateCount,
  selectedPayload,
  type PreviewSelection,
} from "./previewSelection";
import { useIdempotencyKey, useImportConfirm, useImportPreview } from "./useImport";

type Step = "start" | "preview" | "summary";
const steps: Array<[Step, string]> = [
  ["start", "Conta e arquivo"],
  ["preview", "Prévia"],
  ["summary", "Resumo"],
];

export function ImportPage() {
  const [step, setStep] = useState<Step>("start");
  const [accountId, setAccountId] = useState<string>();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview>();
  const [selection, setSelection] = useState<PreviewSelection>({});
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [result, setResult] = useState<ImportConfirmResult>();
  const { key: idempotencyKey, renew } = useIdempotencyKey();
  const previewRequest = useImportPreview();
  const confirmRequest = useImportConfirm();

  const payload = preview ? selectedPayload(preview.rows, selection) : [];
  const duplicateCount = preview ? selectedDuplicateCount(preview.rows, selection) : 0;

  const generatePreview = () => {
    if (!file || !accountId) return;
    previewRequest.mutate(
      { file, accountId },
      {
        onSuccess: (data) => {
          renew();
          confirmRequest.reset();
          setPreview(data);
          setSelection(initialSelection(data.rows));
          setStep("preview");
        },
      },
    );
  };

  // Retries reuse the same session key: the server replays instead of importing twice.
  const sendConfirm = () => {
    if (!file || !accountId || payload.length === 0) return;
    confirmRequest.mutate(
      { file, accountId, idempotencyKey, selections: payload },
      {
        onSuccess: (data) => {
          setResult(data);
          setStep("summary");
        },
      },
    );
  };

  // Selected duplicates need an explicit consent first; the retry of a failure already has it.
  const requestConfirm = () => {
    if (confirmRequest.isPending) return;
    if (duplicateCount > 0) setDuplicatesOpen(true);
    else sendConfirm();
  };

  const confirmDuplicates = () => {
    setDuplicatesOpen(false);
    sendConfirm();
  };

  const cancel = () => {
    setDuplicatesOpen(false);
    previewRequest.reset();
    confirmRequest.reset();
    setPreview(undefined);
    setStep("start");
  };

  const importAnother = () => {
    cancel();
    setFile(null);
    setResult(undefined);
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-normal text-foreground">Importar</h1>
      <ol className="flex flex-wrap gap-4 text-sm">
        {steps.map(([id, label], position) => (
          <li
            key={id}
            aria-current={id === step ? "step" : undefined}
            className={cn(id === step ? "font-semibold" : "text-muted-foreground")}
          >
            {position + 1}. {label}
          </li>
        ))}
      </ol>
      {step === "start" ? (
        <ImportStartStep
          accountId={accountId}
          file={file}
          onAccountChange={setAccountId}
          onFileChange={setFile}
          onSubmit={generatePreview}
          isPending={previewRequest.isPending}
          error={previewRequest.error}
        />
      ) : null}
      {step === "preview" && preview ? (
        <div className="flex flex-col gap-4">
          {confirmRequest.isError ? (
            <ImportFailure
              error={confirmRequest.error}
              onRetry={sendConfirm}
              isRetrying={confirmRequest.isPending}
            />
          ) : null}
          <ImportPreviewTable
            preview={preview}
            selection={selection}
            onSelectionChange={setSelection}
          />
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={requestConfirm}
              disabled={payload.length === 0 || confirmRequest.isPending}
            >
              {confirmRequest.isPending ? "Importando…" : "Confirmar importação"}
            </Button>
            <Button type="button" variant="outline" onClick={cancel}>
              Cancelar
            </Button>
          </div>
          <DuplicateConfirmDialog
            open={duplicatesOpen}
            count={duplicateCount}
            onConfirm={confirmDuplicates}
            onCancel={() => setDuplicatesOpen(false)}
            disabled={confirmRequest.isPending}
          />
        </div>
      ) : null}
      {step === "summary" && result ? (
        <ImportSuccess result={result} onImportAnother={importAnother} />
      ) : null}
    </div>
  );
}

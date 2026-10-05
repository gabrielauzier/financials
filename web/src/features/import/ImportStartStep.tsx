import { useState, type ChangeEvent, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountSelect } from "@/features/accounts/AccountSelect";
import { importErrorMessage } from "./errorMessages";
import { validateImportFile } from "./fileRules";

type ImportStartStepProps = {
  accountId: string | undefined;
  file: File | null;
  onAccountChange: (accountId: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
  isPending?: boolean;
  /** Error returned by the preview request; shown translated to Portuguese. */
  error?: unknown;
};

export function ImportStartStep({
  accountId,
  file,
  onAccountChange,
  onFileChange,
  onSubmit,
  isPending = false,
  error,
}: ImportStartStepProps) {
  const [fileError, setFileError] = useState<string | null>(null);
  const message = fileError ?? (error ? importErrorMessage(error) : null);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    const problem = chosen ? validateImportFile(chosen) : null;
    setFileError(problem);
    onFileChange(problem ? null : chosen);
    if (problem) event.target.value = "";
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (accountId && file) onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="import-account">Conta</Label>
        <AccountSelect id="import-account" value={accountId} onChange={onAccountChange} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="import-file">Arquivo CSV</Label>
        <Input
          id="import-file"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          aria-describedby="import-file-help"
        />
        <p id="import-file-help" className="text-sm text-muted-foreground">
          Extrato da conta ou fatura do cartão Nubank, em CSV, até 5 MB.
        </p>
        {file ? <p className="text-sm">{file.name}</p> : null}
      </div>
      {message ? <Alert variant="destructive">{message}</Alert> : null}
      <div>
        <Button type="submit" disabled={!accountId || !file || isPending}>
          {isPending ? "Gerando prévia…" : "Gerar prévia"}
        </Button>
      </div>
    </form>
  );
}

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { messageForError } from "@/lib/api/errorMessages";
import { formatDateLocal } from "@/lib/format";
import type { ImportedFile } from "@/lib/api/types";
import { useDownloadImport, useImportedFiles } from "./useImport";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Saves a blob through a temporary object URL; the token never goes in a URL. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

type ImportedFilesListProps = {
  onReimport: (file: ImportedFile) => void;
  /** Id of the file whose reimport (download and preview) is running. */
  reimportingId?: string | undefined;
  /** Error of the reimport download, shown here because the page stays on the start step. */
  reimportError?: unknown;
};

export function ImportedFilesList({
  onReimport,
  reimportingId,
  reimportError,
}: ImportedFilesListProps) {
  const files = useImportedFiles();
  const download = useDownloadImport();
  const downloadingId = download.isPending ? download.variables?.id : undefined;

  const startDownload = (file: ImportedFile) => {
    download.mutate(file, { onSuccess: (blob) => saveBlob(blob, file.filename) });
  };

  return (
    <section aria-labelledby="imported-files-title" className="flex max-w-3xl flex-col gap-3">
      <h2 id="imported-files-title" className="text-xl font-semibold">
        Arquivos importados
      </h2>
      {download.isError ? (
        <Alert variant="destructive">{messageForError(download.error, "import")}</Alert>
      ) : null}
      {reimportError ? (
        <Alert variant="destructive">{messageForError(reimportError, "import")}</Alert>
      ) : null}
      {files.isPending ? (
        <div className="flex flex-col gap-2" aria-label="Carregando arquivos importados">
          {[0, 1, 2].map((position) => (
            <Skeleton key={position} data-testid="imported-file-skeleton" className="h-14 w-full" />
          ))}
        </div>
      ) : files.isError ? (
        <Alert variant="destructive" className="flex flex-col items-start gap-2">
          <p>{messageForError(files.error, "import")}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void files.refetch()}>
            Tentar novamente
          </Button>
        </Alert>
      ) : files.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum arquivo importado ainda.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {files.data.map((file) => {
            const busy = downloadingId === file.id || reimportingId === file.id;
            return (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{file.filename}</span>
                  <span className="text-sm text-muted-foreground">
                    {file.account.nickname} · {formatDateLocal(file.createdAt)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {plural(file.importedCount, "importada", "importadas")} ·{" "}
                    {plural(file.skippedCount, "ignorada", "ignoradas")}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => onReimport(file)}
                  >
                    Reimportar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => startDownload(file)}
                  >
                    Baixar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

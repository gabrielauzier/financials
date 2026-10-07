export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = [".csv", ".tsv"];

export function validateImportFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension)))
    return "Selecione um arquivo .csv ou .tsv";
  if (file.size > MAX_IMPORT_FILE_BYTES) return "Arquivo excede 5 MB";
  return null;
}

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

export function validateImportFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".csv")) return "Selecione um arquivo .csv";
  if (file.size > MAX_IMPORT_FILE_BYTES) return "Arquivo excede 5 MB";
  return null;
}

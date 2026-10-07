import { describe, expect, it } from "vitest";
import { MAX_IMPORT_FILE_BYTES, validateImportFile } from "./fileRules";

const file = (name: string, size = 10) => {
  const f = new File(["x"], name);
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("validateImportFile", () => {
  it("aceita .csv e .tsv sem diferenciar maiúsculas de minúsculas", () => {
    for (const name of ["a.csv", "a.tsv", "A.CSV", "A.TSV", "a.Tsv", "extrato sofisa.tsv"]) {
      expect(validateImportFile(file(name)), name).toBeNull();
    }
  });

  it("recusa as demais extensões com a mensagem de .csv ou .tsv", () => {
    for (const name of [
      "a.pdf",
      "a.txt",
      "a.xlsx",
      "a.csv.bak",
      "a.tsvx",
      "a.tsv ",
      "csv",
      "tsv",
      "",
    ]) {
      expect(validateImportFile(file(name)), name).toBe("Selecione um arquivo .csv ou .tsv");
    }
  });

  it("recusa mais de 5 MB, também para .tsv, e aceita exatamente 5 MB", () => {
    expect(validateImportFile(file("a.tsv", MAX_IMPORT_FILE_BYTES + 1))).toBe(
      "Arquivo excede 5 MB",
    );
    expect(validateImportFile(file("a.tsv", MAX_IMPORT_FILE_BYTES))).toBeNull();
  });
});

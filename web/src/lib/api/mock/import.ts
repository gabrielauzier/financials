import type { ImportedFile, ImportPreview, PreviewRow, ImportRowStatus } from "../types";
import { listMockAccounts } from "./accounts";
import { listMockCategories } from "./categories";
import { mockApiError, type MockHandler } from "./index";

const HEADER = "Data,Valor,Identificador,Descrição";

type StoredBatch = ImportedFile & { content: string };

const csv = (...lines: string[]) => [HEADER, ...lines].join("\n");

const seedContents = [
  csv(
    "03/03/2026,-45.90,11111111-0000-4000-8000-000000000001,Compra no débito - Mercado Boa Vista",
    "04/03/2026,-18.00,11111111-0000-4000-8000-000000000002,Compra no débito - Uber",
    "05/03/2026,2500.00,11111111-0000-4000-8000-000000000003,Transferência recebida - Empresa Exemplo",
  ),
  csv(
    "10/02/2026,-32.40,22222222-0000-4000-8000-000000000001,Compra no débito - Padaria Estrela Azul",
    "11/02/2026,-120.00,22222222-0000-4000-8000-000000000002,Compra no débito - Restaurante Sabor",
  ),
];

const accountOf = (index: number) => {
  const accounts = listMockAccounts();
  const account = accounts[index] ?? accounts[0];
  if (!account) throw mockApiError("invalid_account", "Select an active account", 422, "accountId");
  return account;
};

/** Newest first. */
let batches: StoredBatch[] = [
  {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    filename: "extrato-marco.csv",
    mimeType: "text/csv",
    sizeBytes: seedContents[0]?.length ?? 0,
    bank: "Nubank",
    account: { id: accountOf(0).id, nickname: accountOf(0).nickname },
    createdAt: "2026-03-06T12:00:00.000Z",
    rowCount: 3,
    importedCount: 3,
    skippedCount: 0,
    content: seedContents[0] ?? "",
  },
  {
    id: "aaaaaaaa-0000-4000-8000-000000000002",
    filename: "extrato-fevereiro.csv",
    mimeType: "text/csv",
    sizeBytes: seedContents[1]?.length ?? 0,
    bank: "Nubank",
    account: { id: accountOf(0).id, nickname: accountOf(0).nickname },
    createdAt: "2026-02-12T12:00:00.000Z",
    rowCount: 2,
    importedCount: 1,
    skippedCount: 1,
    content: seedContents[1] ?? "",
  },
];

type ParsedRow = { index: number; localDate: string; amount: string; id: string; name: string };

/** jsdom's File has no `text()`; browsers do. */
async function readText(file: Blob): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function parseCsv(content: string): ParsedRow[] {
  const [header, ...lines] = content.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (header?.trim() !== HEADER)
    throw mockApiError("unsupported_format", "Unsupported file format", 422, "file");
  if (lines.length === 0) throw mockApiError("empty_file", "The file has no rows", 422, "file");
  return lines.map((line, index) => {
    const [date = "", amount = "", id = "", ...rest] = line.split(",");
    return { index, localDate: date, amount, id, name: rest.join(",") };
  });
}

/** `dd/mm/aaaa` to `aaaa-mm-dd`; `undefined` when it is not a date. */
function toLocalDate(value: string): string | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

const categoryKeyOf = (name: string) =>
  /mercad|padaria|restaurante|cafe|café/i.test(name)
    ? "Food"
    : /uber|posto/i.test(name)
      ? "Transport"
      : /salário|empresa/i.test(name)
        ? "Salaries"
        : "Uncategorized";

/** Identifiers already imported per account: duplicates of a previous batch are marked as such. */
const importedIds = new Map<string, Set<string>>();
const importedFor = (accountId: string) => {
  let ids = importedIds.get(accountId);
  if (!ids) {
    ids = new Set();
    importedIds.set(accountId, ids);
  }
  return ids;
};
for (const batch of batches) {
  for (const row of parseCsv(batch.content).slice(0, batch.importedCount))
    importedFor(batch.account.id).add(row.id);
}

function activeAccount(accountId: unknown) {
  const account = listMockAccounts().find((item) => item.id === accountId);
  if (!account || !account.active)
    throw mockApiError("invalid_account", "Select an active account", 422, "accountId");
  return account;
}

type ImportForm = { file: File; accountId: string };
function readForm(body: unknown): FormData {
  if (!(body instanceof FormData))
    throw mockApiError("validation_error", "A multipart body is required", 400);
  return body;
}
function requireFile(form: FormData): File {
  const file = form.get("file");
  if (!(file instanceof Blob))
    throw mockApiError("validation_error", "file is required", 400, "file");
  return file as File;
}
async function parseForm(
  form: FormData,
): Promise<ImportForm & { rows: ParsedRow[]; text: string }> {
  const file = requireFile(form);
  const account = activeAccount(form.get("accountId"));
  const text = await readText(file);
  return { file, accountId: account.id, rows: parseCsv(text), text };
}

function buildPreview(rows: ParsedRow[], accountId: string): ImportPreview {
  const categories = listMockCategories();
  const known = importedFor(accountId);
  const totals: ImportPreview["totals"] = {
    new: 0,
    duplicate: 0,
    ignored: 0,
    unrecognized: 0,
    invalid: 0,
  };
  const previewRows = rows.map((row): PreviewRow => {
    const localDate = toLocalDate(row.localDate);
    const amount = /^-?\d+(?:\.\d{1,2})?$/.test(row.amount.trim()) ? row.amount.trim() : undefined;
    const category = categories.find((item) => item.key === categoryKeyOf(row.name));
    if (!category) throw new Error("Mock categories are missing the parser keys");
    let status: ImportRowStatus = "new";
    let reason: string | undefined;
    if (!localDate || amount === undefined) {
      status = "invalid";
      reason = !localDate ? "Data inválida" : "Valor inválido";
    } else if (known.has(row.id)) status = "duplicate";
    totals[status] += 1;
    const negative = amount?.startsWith("-") ?? true;
    return {
      index: row.index,
      localDate: localDate ?? row.localDate,
      type: negative ? "Expense" : "Income",
      amount: (amount ?? row.amount).replace(/^-/, ""),
      name: row.name.replace(/^[^-]+ - /, ""),
      paymentMethod: negative ? "DebitCard" : "BankTransfer",
      categoryId: category.id,
      categoryName: category.name,
      status,
      neutral: false,
      ...(reason === undefined ? {} : { reason }),
      counterpartyDocument: null,
      counterpartyBank: null,
    };
  });
  return { rows: previewRows, totals };
}

const confirmed = new Map<string, { batchId: string; imported: number; skipped: number }>();

type RawSelection = { index: number; neutral: boolean; categoryId?: string };
function parseSelections(raw: unknown): RawSelection[] {
  try {
    const value: unknown = JSON.parse(String(raw));
    if (Array.isArray(value) && value.length > 0) return value as RawSelection[];
  } catch {
    // falls through to the validation error
  }
  throw mockApiError("validation_error", "selections is invalid", 422, "selections");
}

const toImportedFile = (batch: StoredBatch): ImportedFile => {
  const { content: _content, ...file } = batch;
  return file;
};

export const importHandlers: MockHandler[] = [
  {
    method: "GET",
    path: /^\/imports(?:\?.*)?$/,
    handle: ({ path }) => {
      const limit = new URL(path, "http://mock.local").searchParams.get("limit");
      return batches.slice(0, limit === null ? 50 : Number(limit)).map(toImportedFile);
    },
  },
  {
    method: "GET",
    path: /^\/imports\/[^/?]+\/file$/,
    handle: ({ path }) => {
      const batch = batches.find((item) => item.id === path.split("/")[2]);
      if (!batch) throw mockApiError("not_found", "Import not found", 404);
      return new Blob([batch.content], { type: batch.mimeType });
    },
  },
  {
    method: "POST",
    path: "/imports/preview",
    handle: async ({ body }) => {
      const { rows, accountId } = await parseForm(readForm(body));
      return buildPreview(rows, accountId);
    },
  },
  {
    method: "POST",
    path: "/imports/confirm",
    handle: async ({ body }) => {
      const form = readForm(body);
      const key = String(form.get("idempotencyKey") ?? "");
      const replay = confirmed.get(key);
      if (replay) return { ...replay };
      const { file, accountId, rows, text } = await parseForm(form);
      const selections = parseSelections(form.get("selections"));
      const preview = buildPreview(rows, accountId);
      const categoryIds = new Set(listMockCategories().map((category) => category.id));
      for (const selection of selections) {
        const row = preview.rows[selection.index];
        if (!row || row.status === "invalid" || row.status === "ignored")
          throw mockApiError(
            "invalid_selection",
            `Row ${selection.index} cannot be imported`,
            422,
            "selections",
          );
        if (selection.categoryId !== undefined && !categoryIds.has(selection.categoryId))
          throw mockApiError(
            "invalid_category",
            `Row ${selection.index} has a category that does not exist`,
            422,
            "selections",
          );
      }
      const chosen = new Set(selections.map((selection) => selection.index));
      const account = activeAccount(accountId);
      const batch: StoredBatch = {
        id: crypto.randomUUID(),
        filename: file.name,
        mimeType: file.type || "text/csv",
        sizeBytes: file.size,
        bank: account.bank,
        account: { id: account.id, nickname: account.nickname },
        createdAt: new Date().toISOString(),
        rowCount: rows.length,
        importedCount: chosen.size,
        skippedCount: rows.length - chosen.size,
        content: text,
      };
      batches = [batch, ...batches];
      for (const row of rows) if (chosen.has(row.index)) importedFor(accountId).add(row.id);
      const result = {
        batchId: batch.id,
        imported: batch.importedCount,
        skipped: batch.skippedCount,
      };
      confirmed.set(key, result);
      return { ...result };
    },
  },
];

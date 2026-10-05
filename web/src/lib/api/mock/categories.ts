import type { Category } from "../types";
import { mockApiError, type MockHandler } from "./index";

const seed: Array<[string, string, boolean]> = [
  ["Entertainment", "Entretenimento", false],
  ["Food", "Alimentação", false],
  ["Salaries", "Salários", false],
  ["Healthcare", "Saúde", false],
  ["Utilities", "Utilidades", false],
  ["Unknown", "Desconhecida", false],
  ["Transport", "Transporte", false],
  ["Help", "Ajuda (a terceiros)", false],
  ["PJ", "PJ", false],
  ["Bills", "Contas", false],
  ["Emergency", "Emergência", false],
  ["Uncategorized", "Sem categoria", true],
  ["Wishes", "Desejos", false],
  ["Reversal", "Estorno (de compras)", true],
  ["Shopping", "Compras", false],
  ["Pets", "Pets", false],
  ["Investments", "Investimentos", true],
];

let categories: Category[] = seed.map(([key, name, isSystem], index) => ({
  id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  key,
  name,
  isSystem,
}));
const categoriesInUse = new Set(["Entertainment", "Food", "Bills", "Shopping"]);

const findCategory = (id: string) => {
  const category = categories.find((item) => item.id === id);
  if (!category) throw mockApiError("not_found", "Categoria não encontrada", 404);
  return category;
};
const validateName = (name: string, exceptId?: string) => {
  const clean = name.trim();
  if (!clean) throw mockApiError("validation", "Informe o nome", 422, "name");
  if (
    categories.some(
      (item) => item.id !== exceptId && item.name.toLocaleLowerCase() === clean.toLocaleLowerCase(),
    )
  )
    throw mockApiError("duplicate_name", "Já existe uma categoria com esse nome", 409, "name");
  return clean;
};

export const categoriesHandlers: MockHandler[] = [
  { method: "GET", path: "/categories", handle: () => categories.map((item) => ({ ...item })) },
  {
    method: "POST",
    path: "/categories",
    handle: ({ body }) => {
      const name = validateName((body as { name: string }).name);
      const category: Category = { id: crypto.randomUUID(), key: null, name, isSystem: false };
      categories = [...categories, category];
      return category;
    },
  },
  {
    method: "PATCH",
    path: /^\/categories\/[^/?]+$/,
    handle: ({ path, body }) => {
      const id = path.split("/")[2] ?? "";
      const current = findCategory(id);
      if (current.isSystem) throw mockApiError("category_protected", "Categoria protegida", 403);
      const updated = { ...current, name: validateName((body as { name: string }).name, id) };
      categories = categories.map((item) => (item.id === id ? updated : item));
      return updated;
    },
  },
  {
    method: "DELETE",
    path: /^\/categories\/[^/?]+(?:\?.*)?$/,
    handle: ({ path }) => {
      const url = new URL(path, "http://mock.local");
      const id = url.pathname.split("/")[2] ?? "";
      const current = findCategory(id);
      if (current.isSystem) throw mockApiError("category_protected", "Categoria protegida", 403);
      const destinationId = url.searchParams.get("reassignTo");
      if (current.key && categoriesInUse.has(current.key) && !destinationId)
        throw mockApiError("reassign_required", "Escolha uma categoria de destino", 422);
      if (destinationId) {
        if (destinationId === id)
          throw mockApiError("validation", "Destino inválido", 422, "reassignTo");
        findCategory(destinationId);
      }
      if (current.key) categoriesInUse.delete(current.key);
      categories = categories.filter((item) => item.id !== id);
      return undefined;
    },
  },
];

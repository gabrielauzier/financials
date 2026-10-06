import { DEFAULT_COLOR, isColorKey, type ColorKey } from "@/features/colors/palette";
import type { Category } from "../types";
import { mockApiError, type MockHandler } from "./index";
import { categoryHasTransactions, reassignCategoryTransactions } from "./transactionRelations";

const seed: Array<[string, string, boolean, ColorKey]> = [
  ["Entertainment", "Entretenimento", false, "purple-400"],
  ["Food", "Alimentação", false, "orange-400"],
  ["Salaries", "Salários", false, "emerald-400"],
  ["Healthcare", "Saúde", false, "rose-400"],
  ["Utilities", "Utilidades", false, "sky-400"],
  ["Unknown", "Desconhecida", false, "zinc-400"],
  ["Transport", "Transporte", false, "blue-400"],
  ["Help", "Ajuda (a terceiros)", false, "pink-400"],
  ["PJ", "PJ", false, "indigo-400"],
  ["Bills", "Contas", false, "amber-400"],
  ["Emergency", "Emergência", false, "red-400"],
  ["Uncategorized", "Sem categoria", true, "slate-400"],
  ["Wishes", "Desejos", false, "fuchsia-400"],
  ["Reversal", "Estorno (de compras)", true, "teal-400"],
  ["Shopping", "Compras", false, "lime-400"],
  ["Pets", "Pets", false, "yellow-400"],
  ["Investments", "Investimentos", true, "green-400"],
];

let categories: Category[] = seed.map(([key, name, isSystem, color], index) => ({
  id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  key,
  name,
  isSystem,
  color,
}));

export function listMockCategories(): Category[] {
  return categories.map((category) => ({ ...category }));
}

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

const validateColor = (color: unknown): ColorKey | undefined => {
  if (color === undefined) return undefined;
  if (!isColorKey(color))
    throw mockApiError("validation_error", "Escolha uma cor da paleta", 422, "color");
  return color;
};

export const categoriesHandlers: MockHandler[] = [
  { method: "GET", path: "/categories", handle: () => categories.map((item) => ({ ...item })) },
  {
    method: "POST",
    path: "/categories",
    handle: ({ body }) => {
      const input = body as { name: string; color?: unknown };
      const name = validateName(input.name);
      const color = validateColor(input.color);
      const category: Category = {
        id: crypto.randomUUID(),
        key: null,
        name,
        isSystem: false,
        color: color ?? DEFAULT_COLOR,
      };
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
      const input = body as { name?: string; color?: unknown };
      const name = input.name === undefined ? current.name : validateName(input.name, id);
      const color = validateColor(input.color) ?? current.color;
      const updated = { ...current, name, color };
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
      if (categoryHasTransactions(current.id) && !destinationId)
        throw mockApiError("reassign_required", "Escolha uma categoria de destino", 422);
      if (destinationId) {
        if (destinationId === id)
          throw mockApiError("validation", "Destino inválido", 422, "reassignTo");
        findCategory(destinationId);
        reassignCategoryTransactions(current.id, destinationId);
      }
      categories = categories.filter((item) => item.id !== id);
      return undefined;
    },
  },
];

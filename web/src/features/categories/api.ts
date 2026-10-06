import { apiRequest } from "@/lib/api/client";
import type { Category, CategoryInput, CategoryUpdate } from "@/lib/api/types";

export const getCategories = () => apiRequest<Category[]>("/categories");
export const createCategory = (input: CategoryInput) =>
  apiRequest<Category>("/categories", { method: "POST", body: input });
export const updateCategory = ({ id, ...input }: CategoryUpdate & { id: string }) =>
  apiRequest<Category>(`/categories/${id}`, { method: "PATCH", body: input });
export const deleteCategory = ({ id, reassignTo }: { id: string; reassignTo?: string }) =>
  apiRequest<void>(
    `/categories/${id}${reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : ""}`,
    { method: "DELETE" },
  );

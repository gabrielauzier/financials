import { apiRequest } from "@/lib/api/client";
import type { Category } from "@/lib/api/types";

export const getCategories = () => apiRequest<Category[]>("/categories");
export const createCategory = (name: string) =>
  apiRequest<Category>("/categories", { method: "POST", body: { name } });
export const renameCategory = ({ id, name }: { id: string; name: string }) =>
  apiRequest<Category>(`/categories/${id}`, { method: "PATCH", body: { name } });
export const deleteCategory = ({ id, reassignTo }: { id: string; reassignTo?: string }) =>
  apiRequest<void>(
    `/categories/${id}${reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : ""}`,
    { method: "DELETE" },
  );

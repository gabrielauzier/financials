import { useMemo } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createCategory, deleteCategory, getCategories, updateCategory } from "./api";

export const categoriesQueryOptions = () =>
  queryOptions({ queryKey: ["categories"], queryFn: getCategories });
export function useCategories() {
  return useQuery(categoriesQueryOptions());
}
/** Categories by id from the cached list; `ready` is false while loading or when the list failed. */
export function useCategoryLookup() {
  const { data, isSuccess } = useCategories();
  const byId = useMemo(
    () => new Map((data ?? []).map((category) => [category.id, category])),
    [data],
  );
  return { byId, ready: isSuccess };
}
const useCategoriesMutation = <T>(mutationFn: (variables: T) => Promise<unknown>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
};
export const useCreateCategory = () => useCategoriesMutation(createCategory);
export const useUpdateCategory = () => useCategoriesMutation(updateCategory);
export const useDeleteCategory = () => useCategoriesMutation(deleteCategory);

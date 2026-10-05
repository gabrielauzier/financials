import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createCategory, deleteCategory, getCategories, renameCategory } from "./api";

export const categoriesQueryOptions = () =>
  queryOptions({ queryKey: ["categories"], queryFn: getCategories });
export function useCategories() {
  return useQuery(categoriesQueryOptions());
}
const useCategoriesMutation = <T>(mutationFn: (variables: T) => Promise<unknown>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
};
export const useCreateCategory = () => useCategoriesMutation(createCategory);
export const useRenameCategory = () => useCategoriesMutation(renameCategory);
export const useDeleteCategory = () => useCategoriesMutation(deleteCategory);

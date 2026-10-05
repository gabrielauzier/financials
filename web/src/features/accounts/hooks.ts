import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAccount, getAccounts, setAccountActive, updateAccount } from "./api";

export const accountsQueryOptions = (active?: boolean) =>
  queryOptions({ queryKey: ["accounts", { active }], queryFn: () => getAccounts(active) });
export function useAccounts({ active }: { active?: boolean } = {}) {
  return useQuery(accountsQueryOptions(active));
}
const useAccountsMutation = <T>(mutationFn: (variables: T) => Promise<unknown>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  });
};
export const useCreateAccount = () => useAccountsMutation(createAccount);
export const useUpdateAccount = () => useAccountsMutation(updateAccount);
export const useSetAccountActive = () => useAccountsMutation(setAccountActive);

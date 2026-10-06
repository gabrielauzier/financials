import { useMemo } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAccount, getAccounts, setAccountActive, updateAccount } from "./api";

export const accountsQueryOptions = (active?: boolean) =>
  queryOptions({ queryKey: ["accounts", { active }], queryFn: () => getAccounts(active) });
export function useAccounts({ active }: { active?: boolean } = {}) {
  return useQuery(accountsQueryOptions(active));
}
/** All accounts by id from the cached list; `ready` is false while loading or when the list failed. */
export function useAccountLookup() {
  const { data, isSuccess } = useAccounts();
  const byId = useMemo(() => new Map((data ?? []).map((account) => [account.id, account])), [data]);
  return { byId, ready: isSuccess };
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

import { apiRequest } from "@/lib/api/client";
import type { Account, AccountInput, AccountUpdate } from "@/lib/api/types";

export const getAccounts = (active?: boolean) =>
  apiRequest<Account[]>(active === undefined ? "/accounts" : `/accounts?active=${active}`);
export const createAccount = (input: AccountInput) =>
  apiRequest<Account>("/accounts", { method: "POST", body: input });
export const updateAccount = ({ id, input }: { id: string; input: AccountUpdate }) =>
  apiRequest<Account>(`/accounts/${id}`, { method: "PATCH", body: input });
export const setAccountActive = ({ id, active }: { id: string; active: boolean }) =>
  apiRequest<Account>(`/accounts/${id}/${active ? "activate" : "deactivate"}`, { method: "POST" });

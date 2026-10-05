export type Money = string;

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    field?: string;
  };
};

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export type Bank = "Nubank" | "SofisaDireto" | "Neon" | "XP" | "Other";

export type Account = {
  id: string;
  bank: Bank;
  nickname: string;
  holderNames: string[];
  active: boolean;
  createdAt: string;
};

export type AccountInput = Pick<Account, "bank" | "nickname" | "holderNames">;
export type AccountUpdate = Partial<AccountInput>;

export type Category = {
  id: string;
  key: string | null;
  name: string;
  isSystem: boolean;
};

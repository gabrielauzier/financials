import type { Account, AccountInput, AccountUpdate } from "../types";
import { mockApiError, type MockHandler } from "./index";

let accounts: Account[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    bank: "Nubank",
    nickname: "Nubank pessoal",
    holderNames: ["Gabriel Vasconcelos Auzier"],
    active: true,
    createdAt: "2026-01-10T12:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    bank: "Nubank",
    nickname: "Nubank PJ",
    holderNames: ["Gabriel Vasconcelos Auzier LTDA"],
    active: true,
    createdAt: "2026-02-03T12:00:00.000Z",
  },
];

const cleanNames = (names: string[]) => names.map((name) => name.trim()).filter(Boolean);
const duplicateNickname = (nickname: string, exceptId?: string) =>
  accounts.some(
    (account) =>
      account.id !== exceptId &&
      account.nickname.toLocaleLowerCase() === nickname.toLocaleLowerCase(),
  );

function validate(input: AccountInput | AccountUpdate, exceptId?: string) {
  if ("nickname" in input && input.nickname !== undefined) {
    const nickname = input.nickname.trim();
    if (!nickname) throw mockApiError("validation", "Informe o apelido", 422, "nickname");
    if (duplicateNickname(nickname, exceptId))
      throw mockApiError("duplicate_name", "Já existe uma conta com esse apelido", 409, "nickname");
  }
  if (
    "holderNames" in input &&
    input.holderNames !== undefined &&
    cleanNames(input.holderNames).length === 0
  )
    throw mockApiError("holder_required", "Informe ao menos um titular", 422, "holderNames");
}

function getAccount(id: string) {
  const account = accounts.find((item) => item.id === id);
  if (!account) throw mockApiError("not_found", "Conta não encontrada", 404);
  return account;
}

export const accountsHandlers: MockHandler[] = [
  {
    method: "GET",
    path: /^\/accounts(?:\?.*)?$/,
    handle: ({ path }) => {
      const query = new URL(path, "http://mock.local").searchParams.get("active");
      if (query === null) return accounts.map((account) => ({ ...account }));
      const active = query === "true";
      return accounts
        .filter((account) => account.active === active)
        .map((account) => ({ ...account }));
    },
  },
  {
    method: "POST",
    path: "/accounts",
    handle: ({ body }) => {
      const input = body as AccountInput;
      validate(input);
      const account: Account = {
        ...input,
        nickname: input.nickname.trim(),
        holderNames: cleanNames(input.holderNames),
        id: crypto.randomUUID(),
        active: true,
        createdAt: new Date().toISOString(),
      };
      accounts = [...accounts, account];
      return { ...account };
    },
  },
  {
    method: "PATCH",
    path: /^\/accounts\/[^/]+$/,
    handle: ({ path, body }) => {
      const id = path.split("/")[2] ?? "";
      const current = getAccount(id);
      const input = body as AccountUpdate;
      validate(input, id);
      const updated: Account = {
        ...current,
        ...input,
        nickname: input.nickname?.trim() ?? current.nickname,
        holderNames: input.holderNames ? cleanNames(input.holderNames) : current.holderNames,
      };
      accounts = accounts.map((account) => (account.id === id ? updated : account));
      return { ...updated };
    },
  },
  {
    method: "POST",
    path: /^\/accounts\/[^/]+\/(?:deactivate|activate)$/,
    handle: ({ path }) => {
      const parts = path.split("/");
      const id = parts[2] ?? "";
      const current = getAccount(id);
      const updated = { ...current, active: parts[3] === "activate" };
      accounts = accounts.map((account) => (account.id === id ? updated : account));
      return updated;
    },
  },
];

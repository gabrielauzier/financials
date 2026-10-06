import { describe, expect, it } from "vitest";
import { isEmailAlreadyRegistered } from "./emailExists";

describe("isEmailAlreadyRegistered", () => {
  it("identifica usuário sem identidades", () => {
    expect(
      isEmailAlreadyRegistered({
        data: { user: { identities: [] }, session: null },
        error: null,
      } as never),
    ).toBe(true);
  });
  it("aceita um novo usuário com identidade", () => {
    expect(
      isEmailAlreadyRegistered({
        data: { user: { identities: [{}] }, session: null },
        error: null,
      } as never),
    ).toBe(false);
  });

  const withUser = (user: Record<string, unknown>) =>
    ({ data: { user, session: null }, error: null }) as never;
  const created = "2026-10-05T10:00:00.000Z";

  it("identifica o erro user_already_exists", () => {
    expect(
      isEmailAlreadyRegistered({
        data: { user: null, session: null },
        error: { code: "user_already_exists" },
      } as never),
    ).toBe(true);
  });
  it("identifica o e-mail não confirmado quando o envio ocorre 1000 ms ou mais depois da criação", () => {
    expect(
      isEmailAlreadyRegistered(
        withUser({
          identities: [{}],
          created_at: created,
          confirmation_sent_at: "2026-10-05T10:00:01.000Z",
        }),
      ),
    ).toBe(true);
    expect(
      isEmailAlreadyRegistered(
        withUser({
          identities: [{}],
          created_at: created,
          confirmation_sent_at: "2026-10-05T10:05:00.000Z",
        }),
      ),
    ).toBe(true);
  });
  it("trata como novo um usuário com intervalo abaixo de 1000 ms", () => {
    expect(
      isEmailAlreadyRegistered(
        withUser({
          identities: [{}],
          created_at: created,
          confirmation_sent_at: "2026-10-05T10:00:00.999Z",
        }),
      ),
    ).toBe(false);
    expect(
      isEmailAlreadyRegistered(
        withUser({ identities: [{}], created_at: created, confirmation_sent_at: created }),
      ),
    ).toBe(false);
  });
  it("trata como novo quando faltam os carimbos ou eles não são datas (NaN nunca conta como cadastrado)", () => {
    expect(isEmailAlreadyRegistered(withUser({ identities: [{}] }))).toBe(false);
    expect(
      isEmailAlreadyRegistered(
        withUser({ identities: [{}], created_at: created, confirmation_sent_at: "não é data" }),
      ),
    ).toBe(false);
    expect(
      isEmailAlreadyRegistered(
        withUser({ identities: [{}], confirmation_sent_at: "2026-10-05T10:00:05.000Z" }),
      ),
    ).toBe(false);
    expect(
      isEmailAlreadyRegistered({ data: { user: null, session: null }, error: null } as never),
    ).toBe(false);
  });
});

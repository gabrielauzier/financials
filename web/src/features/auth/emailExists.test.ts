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
});

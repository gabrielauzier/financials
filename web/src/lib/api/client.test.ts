import { beforeEach, describe, expect, it, vi } from "vitest";
const authMocks = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: authMocks } }));
vi.mock("./mock", () => ({ shouldMock: () => false, mockRequest: vi.fn() }));
import { ApiError, apiRequest } from "./client";

describe("apiRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
  });
  it("envia token e fuso horário", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    await apiRequest("/accounts");
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(headers.get("X-Timezone")).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
  it("encerra a sessão em 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { code: "unauthorized", message: "Sessão inválida" } }),
            { status: 401 },
          ),
        ),
    );
    await expect(apiRequest("/accounts")).rejects.toBeInstanceOf(ApiError);
    expect(authMocks.signOut).toHaveBeenCalled();
  });
  it("mapeia o erro da API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "invalid", message: "Valor inválido", field: "name" },
          }),
          { status: 422 },
        ),
      ),
    );
    await expect(apiRequest("/accounts")).rejects.toMatchObject({
      code: "invalid",
      message: "Valor inválido",
      field: "name",
      status: 422,
    });
  });
});

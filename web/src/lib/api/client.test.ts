import { beforeEach, describe, expect, it, vi } from "vitest";
const authMocks = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: authMocks } }));
vi.mock("./mock", () => ({ shouldMock: () => false, mockRequest: vi.fn() }));
import { ApiError, apiRequest, apiRequestBlob } from "./client";

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
  it("envia FormData sem alterar o corpo e sem Content-Type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    const form = new FormData();
    form.append("accountId", "abc");
    await apiRequest("/imports/preview", { method: "POST", body: form });
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(init?.body).toBe(form);
    const headers = new Headers(init?.headers);
    expect(headers.has("Content-Type")).toBe(false);
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(headers.get("X-Timezone")).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
  it("mantém o corpo JSON serializado com Content-Type application/json", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    await apiRequest("/accounts", { method: "POST", body: { nickname: "x" } });
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(init?.body).toBe(JSON.stringify({ nickname: "x" }));
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });
  it("encerra a sessão em 401 também com FormData", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "unauthorized", message: "x" } }), {
          status: 401,
        }),
      ),
    );
    await expect(
      apiRequest("/imports/preview", { method: "POST", body: new FormData() }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(authMocks.signOut).toHaveBeenCalled();
  });
});

describe("apiRequestBlob (IMPIMP-14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
  });
  it("envia o token e o fuso e devolve o Blob da resposta", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("data,csv\n1,2\n", { status: 200, headers: { "Content-Type": "text/csv" } }),
        ),
    );
    const blob = await apiRequestBlob("/imports/abc/file");
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).toContain("/imports/abc/file");
    expect(String(url)).not.toContain("token");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(headers.get("X-Timezone")).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(init?.method).toBe("GET");
    // The response Blob comes from the runtime fetch implementation, not jsdom.
    expect(blob.type).toBe("text/csv");
    expect(await blob.text()).toBe("data,csv\n1,2\n");
  });
  it("lança ApiError com o código da API quando o corpo de erro é da API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "storage_error", message: "x" } }), {
          status: 502,
        }),
      ),
    );
    await expect(apiRequestBlob("/imports/abc/file")).rejects.toMatchObject({
      code: "storage_error",
      status: 502,
    });
  });
  it("lança unexpected_error quando o erro não é JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 500 })));
    await expect(apiRequestBlob("/imports/abc/file")).rejects.toMatchObject({
      code: "unexpected_error",
      status: 500,
    });
  });
  it("encerra a sessão em 401 como o apiRequest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "unauthorized", message: "x" } }), {
          status: 401,
        }),
      ),
    );
    await expect(apiRequestBlob("/imports/abc/file")).rejects.toBeInstanceOf(ApiError);
    expect(authMocks.signOut).toHaveBeenCalled();
  });
});

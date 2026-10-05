import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const authMocks = vi.hoisted(() => ({
  listener: (_event: string, _session: unknown) => {},
  getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
  signUp: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      ...authMocks,
      onAuthStateChange: vi.fn((callback) => {
        authMocks.listener = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));
import { SessionProvider, useSession } from "./useSession";

describe("useSession", () => {
  it("restaura e acompanha a sessão", async () => {
    const { result } = renderHook(() => useSession(), { wrapper: SessionProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => authMocks.listener("SIGNED_IN", { access_token: "token", user: {} }));
    expect(result.current.session).not.toBeNull();
  });
  it("envia metadados no cadastro", async () => {
    const { result } = renderHook(() => useSession(), { wrapper: SessionProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.signUp({
      nome: "Ana",
      apelido: "Ani",
      email: "ana@example.com",
      senha: "12345678",
    });
    expect(authMocks.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ data: { name: "Ana", nickname: "Ani" } }),
      }),
    );
  });
});

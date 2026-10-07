import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const authMocks = vi.hoisted(() => ({
  listener: (_event: string, _session: unknown) => {},
  getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      onAuthStateChange: vi.fn((callback) => {
        authMocks.listener = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));
import { SessionProvider, useSession } from "./useSession";
import { useSessionUserId } from "./useSessionUserId";

describe("useSessionUserId", () => {
  it("devolve o id do usuário da sessão e volta a null quando a sessão acaba", async () => {
    const { result } = renderHook(() => useSessionUserId(), { wrapper: SessionProvider });
    await waitFor(() => expect(authMocks.getSession).toHaveBeenCalled());
    expect(result.current).toBeNull();
    act(() => authMocks.listener("SIGNED_IN", { access_token: "t", user: { id: "user-42" } }));
    expect(result.current).toBe("user-42");
    act(() => authMocks.listener("SIGNED_OUT", null));
    expect(result.current).toBeNull();
  });

  it("devolve null fora de um SessionProvider, sem lançar", () => {
    const { result } = renderHook(() => useSessionUserId());
    expect(result.current).toBeNull();
  });

  it("useSession continua lançando fora do provedor", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useSession())).toThrow(
      "useSession deve ser usado dentro de SessionProvider",
    );
    error.mockRestore();
  });
});

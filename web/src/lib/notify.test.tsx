import { QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { GENERIC_ERROR } from "@/lib/api/errorMessages";
import { notifyError, notifySuccess } from "./notify";
import { Route } from "@/routes/__root";

vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("sonner")>()),
  toast: { success: vi.fn(), error: vi.fn() },
}));
// The root component needs a router and a session only for the page content, not for the Toaster.
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Outlet: () => <main>conteúdo da rota</main>,
}));
vi.mock("@/features/auth/useSession", () => ({
  SessionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});
afterEach(cleanup);

describe("notify", () => {
  it("notifySuccess emite toast.success com o texto exato", () => {
    notifySuccess("Transação criada");
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Transação criada");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("notifyError emite toast.error com a mensagem em português mapeada pelo código", () => {
    notifyError(new ApiError("not_found", "Missing ids", 404), "transaction");
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(
      "Registro não encontrado. Atualize a página e tente de novo",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("notifyError usa o contexto: duplicate_name de conta vira a mensagem de conta", () => {
    notifyError(new ApiError("duplicate_name", "Duplicate nickname", 409), "account");
    expect(toast.error).toHaveBeenCalledExactlyOnceWith("Já existe uma conta com esse apelido");
  });

  it("código desconhecido, erro de rede e valor que não é ApiError mostram a mensagem genérica, nunca a da API", () => {
    expect(GENERIC_ERROR).toBe("Não foi possível concluir a operação. Tente novamente.");
    notifyError(new ApiError("brand_new_code", "Kaboom", 500), "transaction");
    notifyError(new TypeError("Failed to fetch"), "transaction");
    notifyError("texto solto", "transaction");
    notifyError(undefined);
    expect(vi.mocked(toast.error).mock.calls).toEqual([
      [GENERIC_ERROR],
      [GENERIC_ERROR],
      [GENERIC_ERROR],
      [GENERIC_ERROR],
    ]);
  });

  it("o RootComponent monta o Toaster exatamente uma vez (uma região Notifications)", () => {
    const RootComponent = Route.options.component as () => ReactNode;
    vi.spyOn(Route, "useRouteContext").mockReturnValue({ queryClient: new QueryClient() });
    render(<RootComponent />);
    expect(screen.getByText("conteúdo da rota")).toBeInTheDocument();
    expect(screen.getAllByRole("region", { name: /Notifications/ })).toHaveLength(1);
  });
});

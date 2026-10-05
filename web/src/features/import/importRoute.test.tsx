import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: ReactNode }) => (
    <div data-testid="require-auth">{children}</div>
  ),
}));
vi.mock("@/features/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));
vi.mock("./ImportPage", () => ({ ImportPage: () => <p>Página de importação</p> }));
import { Route } from "@/routes/importar";

afterEach(cleanup);

describe("rota /importar", () => {
  it("renderiza a página de importação dentro do layout autenticado", () => {
    const Component = Route.options.component as () => ReactNode;
    render(<Component />);
    const page = screen.getByText("Página de importação");
    expect(page.closest('[data-testid="app-layout"]')).not.toBeNull();
    expect(page.closest('[data-testid="require-auth"]')).not.toBeNull();
    expect(screen.getByTestId("require-auth").contains(screen.getByTestId("app-layout"))).toBe(
      true,
    );
  });
});

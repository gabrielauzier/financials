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
vi.mock("./DashboardPage", () => ({
  DashboardPage: () => <p>Página do dashboard</p>,
}));
import { Route } from "@/routes/index";

afterEach(cleanup);

describe("rota /", () => {
  it("renderiza o dashboard dentro do layout autenticado", () => {
    const Component = Route.options.component as () => ReactNode;
    render(<Component />);
    const page = screen.getByText("Página do dashboard");
    expect(page.closest('[data-testid="app-layout"]')).not.toBeNull();
    expect(page.closest('[data-testid="require-auth"]')).not.toBeNull();
    expect(screen.getByTestId("require-auth").contains(screen.getByTestId("app-layout"))).toBe(
      true,
    );
  });
});

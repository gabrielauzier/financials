import { render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
let state: { session: unknown; loading: boolean } = { session: null, loading: false };
vi.mock("./useSession", () => ({ useSession: () => state }));
import { RequireAuth } from "./RequireAuth";
function makeRouter() {
  const root = createRootRoute({ component: Outlet });
  const login = createRoute({
    getParentRoute: () => root,
    path: "/login",
    component: () => <p>Login</p>,
    validateSearch: (s) => s,
  });
  const privateRoute = createRoute({
    getParentRoute: () => root,
    path: "/private",
    component: () => (
      <RequireAuth>
        <p>Privado</p>
      </RequireAuth>
    ),
  });
  return createRouter({
    routeTree: root.addChildren([login, privateRoute]),
    history: createMemoryHistory({ initialEntries: ["/private"] }),
  });
}
describe("RequireAuth", () => {
  it("redireciona sem sessão", async () => {
    state = { session: null, loading: false };
    render(<RouterProvider router={makeRouter()} />);
    expect(await screen.findByText("Login")).toBeInTheDocument();
  });
  it("mostra conteúdo com sessão", async () => {
    state = { session: {}, loading: false };
    render(<RouterProvider router={makeRouter()} />);
    expect(await screen.findByText("Privado")).toBeInTheDocument();
  });
});

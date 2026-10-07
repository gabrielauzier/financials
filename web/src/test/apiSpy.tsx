import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { mockRequest } from "@/lib/api/mock";

export type RecordedRequest = { method: string; path: string; body: unknown };

/** Calls forced to fail, keyed by "METHOD /path" (ids replaced by ":id"). */
export const failures = new Map<string, unknown>();
/** Canned responses keyed like `failures`; a function is called to produce (or delay) the value. */
export const responses = new Map<string, unknown>();
/** Every request sent through the mocked API wrapper, in order. */
export const requests: RecordedRequest[] = [];

const routeKey = (method: string, path: string) =>
  `${method} ${path
    .split("?")[0]
    ?.replace(/^\/transactions\/(?!category$|summary$)[^/]+/, "/transactions/:id")
    .replace(/^\/credit-expenses\/[^/]+/, "/credit-expenses/:id")
    .replace(/^\/investment-returns\/[^/]+/, "/investment-returns/:id")}`;

/** Replacement for `apiRequest`: records the call, may fail it, otherwise hits the mocks. */
export async function spiedApiRequest(
  path: string,
  options: { method?: string; body?: unknown } = {},
) {
  const method = options.method?.toUpperCase() ?? "GET";
  requests.push({ method, path, body: options.body });
  const failure = failures.get(routeKey(method, path));
  if (failure) throw failure;
  const canned = responses.get(routeKey(method, path));
  if (canned !== undefined) return typeof canned === "function" ? canned() : canned;
  return mockRequest({ method, path, body: options.body });
}

export function resetSpy() {
  failures.clear();
  responses.clear();
  requests.length = 0;
}

export function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

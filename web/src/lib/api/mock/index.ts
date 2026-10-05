import { accountsHandlers } from "./accounts";
import { categoriesHandlers } from "./categories";
import { creditExpensesHandlers } from "./creditExpenses";
import { dashboardHandlers } from "./dashboard";
import { importHandlers } from "./import";
import { investmentReturnsHandlers } from "./investmentReturns";
import { transactionsHandlers } from "./transactions";

export type ApiArea =
  | "accounts"
  | "categories"
  | "transactions"
  | "import"
  | "creditExpenses"
  | "dashboard"
  | "investmentReturns";

export type MockRequest = { method: string; path: string; body?: unknown };
export type MockHandler = {
  method: string;
  path: string | RegExp;
  handle: (request: MockRequest) => unknown | Promise<unknown>;
};

export function mockApiError(code: string, message: string, status: number, field?: string) {
  return Object.assign(new Error(message), { code, status, ...(field ? { field } : {}) });
}

const pathAreaMap: Record<string, ApiArea> = {
  accounts: "accounts",
  categories: "categories",
  transactions: "transactions",
  import: "import",
  "credit-expenses": "creditExpenses",
  dashboard: "dashboard",
  "investment-returns": "investmentReturns",
};

const handlers: MockHandler[] = [
  ...accountsHandlers,
  ...categoriesHandlers,
  ...transactionsHandlers,
  ...importHandlers,
  ...creditExpensesHandlers,
  ...dashboardHandlers,
  ...investmentReturnsHandlers,
];

export function areaFromPath(path: string): ApiArea | undefined {
  const segment = path.replace(/^\//, "").split(/[/?#]/)[0];
  if (!segment) return undefined;
  return pathAreaMap[segment];
}

export function shouldMock(path: string): boolean {
  const configured = (import.meta.env["VITE_MOCK_AREAS"] ?? "*")
    .split(",")
    .map((value: string) => value.trim())
    .filter(Boolean);
  const area = areaFromPath(path);
  return configured.includes("*") || (area !== undefined && configured.includes(area));
}

export async function mockRequest<T>(request: MockRequest): Promise<T> {
  const handler = handlers.find((candidate) => {
    const pathMatches =
      typeof candidate.path === "string"
        ? candidate.path === request.path
        : candidate.path.test(request.path);
    return candidate.method.toUpperCase() === request.method.toUpperCase() && pathMatches;
  });
  if (!handler) {
    throw new Error(`Mock ainda não implementado para ${request.method} ${request.path}`);
  }
  return (await handler.handle(request)) as T;
}

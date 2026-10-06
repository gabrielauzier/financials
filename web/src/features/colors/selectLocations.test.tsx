import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import neon from "@/assets/banks/neon.svg";
import { CreditExpenseForm } from "@/features/creditExpenses/CreditExpenseForm";
import { InvestmentReturnForm } from "@/features/dashboard/InvestmentReturnForm";
import { ImportStartStep } from "@/features/import/ImportStartStep";
import { TransactionForm } from "@/features/transactions/TransactionForm";
import { mockRequest } from "@/lib/api/mock";
import type { Account } from "@/lib/api/types";
import { renderWithQuery, resetSpy, responses } from "@/test/apiSpy";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
});

/**
 * COLOR-10 AC 3 and 4, ICON-03 AC 6: every location that renders the shared `CategorySelect` or
 * `AccountSelect` (outside the extrato page, which has its own file) shows the badge, or the
 * icon and dot, in its options. One small render per location, no full page.
 */
async function stubAccounts() {
  const [first] = await mockRequest<Account[]>({ method: "GET", path: "/accounts" });
  if (!first) throw new Error("seed");
  responses.set("GET /accounts", [
    { ...first, bank: "Neon", nickname: "Neon local", color: "sky-400", active: true },
  ]);
}

async function openSelect(root: HTMLElement | Document, label: string) {
  const trigger = within(root as HTMLElement).getByLabelText(label);
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
}

async function expectAccountOption() {
  const option = await screen.findByRole("option", { name: "Neon local" });
  expect(option.querySelector("img")).toHaveAttribute("src", neon);
  expect(option.querySelector("span.rounded-full.size-2\\.5")).toHaveClass("bg-sky-400");
}

async function expectFoodBadge() {
  const option = await screen.findByRole("option", { name: "Alimentação" });
  expect(within(option).getByText("Alimentação")).toHaveClass("bg-orange-600");
}

describe("select locations outside the extrato page", () => {
  it("the transaction form and modal: account select shows icon and dot, category select shows badges", async () => {
    await stubAccounts();
    renderWithQuery(<TransactionForm open onOpenChange={vi.fn()} />);
    const dialog = await screen.findByRole("dialog");
    await openSelect(dialog, "Conta");
    await expectAccountOption();
    fireEvent.keyDown(screen.getByRole("option", { name: "Neon local" }), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("option")).not.toBeInTheDocument());
    await openSelect(dialog, "Categoria");
    await expectFoodBadge();
  });

  it("the credit-expense form: account select shows icon and dot, category select shows badges", async () => {
    await stubAccounts();
    renderWithQuery(<CreditExpenseForm open onOpenChange={vi.fn()} />);
    const dialog = await screen.findByRole("dialog");
    await openSelect(dialog, "Conta");
    await expectAccountOption();
    fireEvent.keyDown(screen.getByRole("option", { name: "Neon local" }), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("option")).not.toBeInTheDocument());
    await openSelect(dialog, "Categoria");
    await expectFoodBadge();
  });

  it("the investment-return form: account select shows icon and dot", async () => {
    await stubAccounts();
    renderWithQuery(<InvestmentReturnForm open onOpenChange={vi.fn()} />);
    const dialog = await screen.findByRole("dialog");
    await openSelect(dialog, "Conta");
    await expectAccountOption();
  });

  it("the import start step: account select shows icon and dot", async () => {
    await stubAccounts();
    renderWithQuery(
      <ImportStartStep
        accountId={undefined}
        file={null}
        onAccountChange={vi.fn()}
        onFileChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    await openSelect(document.body, "Conta");
    await expectAccountOption();
  });
});

import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import neon from "@/assets/banks/neon.svg";
import nubank from "@/assets/banks/nubank.svg";
import xp from "@/assets/banks/xp.svg";
import { mockRequest } from "@/lib/api/mock";
import type { Account, Category, Transaction } from "@/lib/api/types";
import { failures, renderWithQuery, resetSpy, responses } from "@/test/apiSpy";
import { trimTransactions } from "@/test/extratoKit";
import { TransactionsPage } from "./TransactionsPage";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

// each test seeds or canned the rows it acts on: the 120 rows of the mock would only make every render slower
beforeAll(() => trimTransactions());

afterEach(() => {
  cleanup();
  resetSpy();
});

/** One uniquely named transaction dated in 2030 (leads the default date-desc page) on the first account. */
async function seedOne(name: string, index = 0) {
  const list = await mockRequest<Account[]>({ method: "GET", path: "/accounts" });
  const first = list[index];
  if (!first) throw new Error("seed");
  const item = await mockRequest<Transaction>({
    method: "POST",
    path: "/transactions",
    body: {
      name,
      type: "Expense",
      occurredAt: "2030-02-20T12:00:00Z",
      amount: "10.00",
      accountId: first.id,
      paymentMethod: "PIX",
    },
  });
  return { item, account: first };
}

const rowOf = async (name: string) => {
  const cells = await screen.findAllByText(name);
  return cells.find((cell) => cell.closest("tr"))?.closest("tr") as HTMLElement;
};
const cardOf = async (name: string) => {
  const headings = await screen.findAllByRole("heading", { name });
  return headings.find((heading) => heading.closest("article"))?.closest("article") as HTMLElement;
};
const accountCell = (row: HTMLElement) => within(row).getAllByRole("cell")[3] as HTMLElement;
async function foodCategory() {
  const categories = await mockRequest<Category[]>({ method: "GET", path: "/categories" });
  return categories.find((category) => category.key === "Food") as Category;
}
const dot = (root: HTMLElement) => root.querySelector("span.rounded-full.size-2\\.5");

describe("extrato: ícone e cor da conta (ICON-03 AC 3, 4)", () => {
  it("a linha e o cartão mostram o ícone, o apelido e o ponto da conta resolvida por accountId; conta inativa sem sufixo; o select de categoria da linha mostra o badge", async () => {
    const { item, account } = await seedOne("Conta label A");
    const second = await seedOne("Conta label B", 1);
    responses.set("GET /accounts", [
      { ...account, bank: "XP", color: "orange-400" },
      { ...second.account, bank: "Nubank", active: false, color: "lime-400" },
    ]);
    renderWithQuery(<TransactionsPage />);
    const cell = accountCell(await rowOf(item.name));
    await waitFor(() => expect(cell.querySelector("img")).toHaveAttribute("src", xp));
    expect(cell).toHaveTextContent(item.accountNickname);
    expect(dot(cell)).toHaveClass("bg-orange-400");
    const card = await cardOf(item.name);
    const label = card.querySelector("img")?.closest("span.flex") as HTMLElement;
    expect(label).toHaveTextContent(item.accountNickname);
    expect(card.querySelector("img")).toHaveAttribute("src", xp);
    expect(dot(card)).toHaveClass("bg-orange-400");
    // the row category select of the same row: badge in the value and in the opened options
    const food = await foodCategory();
    const rowSelect = within(await rowOf(item.name)).getAllByRole("combobox")[0] as HTMLElement;
    expect(within(rowSelect).getByText(item.categoryName)).toHaveClass("inline-block", "truncate");
    fireEvent.click(rowSelect);
    const option = await screen.findByRole("option", { name: food.name });
    expect(within(option).getByText(food.name)).toHaveClass("bg-orange-200");
    fireEvent.keyDown(option, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("option")).not.toBeInTheDocument());
    // a transaction of an inactive account: the bank of that account, its dot, no (inativa) suffix
    const inactive = accountCell(await rowOf(second.item.name));
    await waitFor(() => expect(inactive.querySelector("img")).toHaveAttribute("src", nubank));
    expect(dot(inactive)).toHaveClass("bg-lime-400");
    expect(inactive).toHaveTextContent(second.item.accountNickname);
    expect(inactive).not.toHaveTextContent("(inativa)");
  });

  it("while GET /accounts is pending the row and the card show only the nickname, then swap to the label", async () => {
    const { item, account } = await seedOne("Conta label C");
    let release: (value: Account[]) => void = () => {};
    responses.set(
      "GET /accounts",
      () =>
        new Promise<Account[]>((resolve) => {
          release = resolve;
        }),
    );
    renderWithQuery(<TransactionsPage />);
    const row = await rowOf(item.name);
    const cell = accountCell(row);
    expect(cell).toHaveTextContent(item.accountNickname);
    expect(cell.querySelector("img")).toBeNull();
    expect(dot(cell)).toBeNull();
    const card = await cardOf(item.name);
    expect(card.querySelector("img")).toBeNull();
    expect(card).toHaveTextContent(`· ${item.accountNickname}`);
    // the rest of the row renders as before
    expect(within(row).getByText(item.name)).toBeInTheDocument();
    expect(within(row).getAllByRole("combobox")[0]).toHaveTextContent(item.categoryName);
    expect(within(row).getByText(/10,00/)).toBeInTheDocument();
    release([{ ...account, bank: "Neon", color: "sky-400" }]);
    await waitFor(() => expect(accountCell(row).querySelector("img")).toHaveAttribute("src", neon));
    expect(dot(accountCell(row))).toHaveClass("bg-sky-400");
  });

  it("when GET /accounts fails the row and the card keep only the nickname text", async () => {
    const { item } = await seedOne("Conta label D");
    failures.set("GET /accounts", new Error("boom"));
    renderWithQuery(<TransactionsPage />);
    const row = await rowOf(item.name);
    await waitFor(() => expect(failures.size).toBe(1));
    expect(accountCell(row)).toHaveTextContent(item.accountNickname);
    expect(accountCell(row).querySelector("img")).toBeNull();
    expect(dot(accountCell(row))).toBeNull();
    const card = await cardOf(item.name);
    expect(card.querySelector("img")).toBeNull();
    expect(within(row).getAllByRole("combobox")[0]).toHaveTextContent(item.categoryName);
  });
});

describe("extrato: selects com badge e rótulo de conta (COLOR-10 AC 3, ICON-03 AC 6)", () => {
  it("the filter account select shows labels with icon and dot in its options", async () => {
    const { account } = await seedOne("Conta label F");
    responses.set("GET /accounts", [
      { ...account, bank: "Neon", nickname: "Neon filtro", color: "sky-400" },
      {
        ...account,
        id: "other",
        bank: "XP",
        nickname: "XP filtro",
        color: "zinc-400",
        active: false,
      },
    ]);
    renderWithQuery(<TransactionsPage />);
    const trigger = await screen.findByLabelText("Conta");
    await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger);
    const neonOption = await screen.findByRole("option", { name: "Neon filtro" });
    const xpOption = screen.getByRole("option", { name: "XP filtro (inativa)" });
    expect(neonOption.querySelector("img")).toHaveAttribute("src", neon);
    expect(dot(neonOption)).toHaveClass("bg-sky-400");
    expect(xpOption.querySelector("img")).toHaveAttribute("src", xp);
    expect(dot(xpOption)).toHaveClass("bg-zinc-400");
  });

  it("the filter category select shows badges in its options", async () => {
    await seedOne("Conta label G1");
    const food = await foodCategory();
    renderWithQuery(<TransactionsPage />);
    const filter = await screen.findByLabelText("Categoria");
    await waitFor(() => expect(filter).toBeEnabled());
    fireEvent.click(filter);
    const option = await screen.findByRole("option", { name: food.name });
    expect(within(option).getByText(food.name)).toHaveClass("bg-orange-200");
  });

  it("the bulk-apply category select shows badges in its options and in its value", async () => {
    const { item } = await seedOne("Conta label G3");
    const food = await foodCategory();
    renderWithQuery(<TransactionsPage />);
    const row = await rowOf(item.name);
    fireEvent.click(within(row).getByRole("checkbox"));
    const bar = (await screen.findByText(/selecionada\(s\)/)).parentElement as HTMLElement;
    fireEvent.click(within(bar).getByRole("combobox"));
    const option = await screen.findByRole("option", { name: food.name });
    expect(within(option).getByText(food.name)).toHaveClass("bg-orange-200");
    fireEvent.click(option);
    await waitFor(() =>
      expect(within(within(bar).getByRole("combobox")).getByText(food.name)).toHaveClass(
        "bg-orange-200",
      ),
    );
  });
});

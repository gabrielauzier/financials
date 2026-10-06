import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import neon from "@/assets/banks/neon.svg";
import nubank from "@/assets/banks/nubank.svg";
import type { Account } from "@/lib/api/types";
import { failures, renderWithQuery, resetSpy, responses } from "@/test/apiSpy";
import { AccountLabel } from "./AccountLabel";
import { AccountSelect } from "./AccountSelect";
import { useAccountLookup, useAccounts } from "./hooks";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
});

const account = (over: Partial<Account>): Account => ({
  id: "a1",
  bank: "Nubank",
  nickname: "Nubank pessoal",
  holderNames: ["G"],
  active: true,
  color: "purple-400",
  createdAt: "2026-01-01",
  ...over,
});
const fixtures = [
  account({ id: "a1" }),
  account({ id: "a2", bank: "Neon", nickname: "Neon reserva", color: "sky-400", active: false }),
];
const dotOf = (root: HTMLElement) =>
  root.querySelector("span.rounded-full.size-2\\.5") as HTMLElement;

describe("AccountLabel (ICON-03 AC 1, ICON-04 AC 7)", () => {
  it("renders the bank icon, the nickname and a dot with the account color", () => {
    const { container } = render(<AccountLabel account={account({})} />);
    expect(container.querySelector("img")).toHaveAttribute("src", nubank);
    expect(screen.getByText("Nubank pessoal")).toBeInTheDocument();
    expect(dotOf(container)).toHaveClass("bg-purple-400");
  });

  it("hides the dot and the icon from the accessibility tree; the nickname is the text", () => {
    const { container } = render(<AccountLabel account={account({})} />);
    expect(dotOf(container)).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("[aria-hidden='true'] img")).not.toBeNull();
    expect(container).toHaveTextContent(/^Nubank pessoal$/);
  });

  it("uses the slate-400 dot for a color outside the palette", () => {
    const { container } = render(<AccountLabel account={account({ color: "banana" as never })} />);
    expect(dotOf(container)).toHaveClass("bg-slate-400");
  });

  it("appends (inativa) in the same text node only when asked and inactive", () => {
    const inactive = account({ active: false });
    const { container, rerender } = render(<AccountLabel account={inactive} showInactive />);
    expect(screen.getByText("Nubank pessoal (inativa)")).toBeInTheDocument();
    rerender(<AccountLabel account={inactive} />);
    expect(container).toHaveTextContent(/^Nubank pessoal$/);
    rerender(<AccountLabel account={account({})} showInactive />);
    expect(container).toHaveTextContent(/^Nubank pessoal$/);
  });
});

describe("AccountSelect with labels (ICON-03 AC 1, 2, 6)", () => {
  it("renders each item as a label and keeps the nickname (with inativa) as option name", async () => {
    responses.set("GET /accounts", fixtures);
    renderWithQuery(<AccountSelect includeInactive onChange={vi.fn()} />);
    const trigger = await screen.findByRole("combobox");
    await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger);
    const nubankOption = await screen.findByRole("option", { name: "Nubank pessoal" });
    const neonOption = screen.getByRole("option", { name: "Neon reserva (inativa)" });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(nubankOption.querySelector("img")).toHaveAttribute("src", nubank);
    expect(dotOf(nubankOption)).toHaveClass("bg-purple-400");
    expect(neonOption.querySelector("img")).toHaveAttribute("src", neon);
    expect(dotOf(neonOption)).toHaveClass("bg-sky-400");
  });

  it("the trigger shows the same label for the selected account", async () => {
    responses.set("GET /accounts", fixtures);
    renderWithQuery(<AccountSelect includeInactive value="a2" onChange={vi.fn()} />);
    const trigger = await screen.findByRole("combobox");
    await waitFor(() => expect(trigger).toHaveTextContent("Neon reserva (inativa)"));
    expect(trigger.querySelector("img")).toHaveAttribute("src", neon);
    expect(dotOf(trigger)).toHaveClass("bg-sky-400");
  });

  it("without includeInactive lists only active accounts", async () => {
    renderWithQuery(<AccountSelect onChange={vi.fn()} />);
    const trigger = await screen.findByRole("combobox");
    await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger);
    const options = await screen.findAllByRole("option");
    for (const option of options) expect(option).not.toHaveTextContent("(inativa)");
  });

  it("shows Carregando contas… and stays disabled while pending", () => {
    responses.set("GET /accounts", () => new Promise(() => {}));
    renderWithQuery(<AccountSelect onChange={vi.fn()} />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent("Carregando contas…");
    expect(within(trigger).queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("useAccountLookup", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );

  it("is not ready with an empty map while loading", () => {
    responses.set("GET /accounts", () => new Promise(() => {}));
    const { result } = renderHook(() => useAccountLookup(), { wrapper });
    expect(result.current.ready).toBe(false);
    expect(result.current.byId.size).toBe(0);
  });

  it("is not ready with an empty map when the list fails", async () => {
    failures.set("GET /accounts", new Error("boom"));
    const { result } = renderHook(
      () => ({ lookup: useAccountLookup(), state: useAccounts().isError }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.state).toBe(true));
    expect(result.current.lookup.ready).toBe(false);
    expect(result.current.lookup.byId.size).toBe(0);
  });

  it("returns every account (active or not) by id once loaded", async () => {
    responses.set("GET /accounts", fixtures);
    const { result } = renderHook(() => useAccountLookup(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.byId.size).toBe(2);
    expect(result.current.byId.get("a2")?.nickname).toBe("Neon reserva");
  });
});

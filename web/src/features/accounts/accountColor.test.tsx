import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import neon from "@/assets/banks/neon.svg";
import nubank from "@/assets/banks/nubank.svg";
import { ApiError } from "@/lib/api/client";
import { GENERIC_ERROR } from "@/lib/api/errorMessages";
import type { Account } from "@/lib/api/types";
import { renderWithQuery, requests, resetSpy, responses, failures } from "@/test/apiSpy";
import { AccountForm } from "./AccountForm";
import { AccountsPage } from "./AccountsPage";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
});

const base: Account = {
  id: "acc-1",
  bank: "Nubank",
  nickname: "Nubank pessoal",
  holderNames: ["Gabriel"],
  active: true,
  color: "purple-400",
  createdAt: "2026-01-01",
};

async function pickColor(name: string) {
  fireEvent.click(screen.getByLabelText("Cor"));
  fireEvent.click(await screen.findByRole("radio", { name }));
  await waitFor(() => expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument());
}
const lastRequest = (method: string) => requests.filter((r) => r.method === method).at(-1);
const barOf = (article: HTMLElement) =>
  article.querySelector("span[aria-hidden='true'].w-1\\.5") as HTMLElement;

describe("AccountForm color (COLOR-08)", () => {
  it("a new account opens with Ardósia and the edit form with the account color (AC 1)", () => {
    const { unmount } = renderWithQuery(<AccountForm open onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText("Cor")).toHaveTextContent("Ardósia");
    unmount();
    renderWithQuery(
      <AccountForm open onOpenChange={vi.fn()} account={{ ...base, color: "teal-400" }} />,
    );
    expect(screen.getByLabelText("Cor")).toHaveTextContent("Verde-azulado");
  });

  it("sends the chosen color with the other fields in the POST (AC 2)", async () => {
    const onOpenChange = vi.fn();
    renderWithQuery(<AccountForm open onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByLabelText("Apelido"), { target: { value: "Conta colorida" } });
    fireEvent.change(screen.getByLabelText("Titulares"), { target: { value: "Gabriel" } });
    await pickColor("Laranja");
    expect(screen.getByLabelText("Cor")).toHaveTextContent("Laranja");
    fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(lastRequest("POST")?.body).toEqual({
      bank: "Nubank",
      nickname: "Conta colorida",
      holderNames: ["Gabriel"],
      color: "orange-400",
    });
  });

  it("sends the new color with the other fields in the PATCH (AC 2)", async () => {
    const onOpenChange = vi.fn();
    responses.set("GET /accounts", [base]);
    renderWithQuery(<AccountForm open onOpenChange={onOpenChange} account={base} />);
    await pickColor("Rosa");
    fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));
    await waitFor(() => expect(lastRequest("PATCH")).toBeDefined());
    expect(lastRequest("PATCH")?.path).toBe("/accounts/acc-1");
    expect(lastRequest("PATCH")?.body).toEqual({
      bank: "Nubank",
      nickname: "Nubank pessoal",
      holderNames: ["Gabriel"],
      color: "pink-400",
    });
  });

  it("a 422 on color shows the palette message and keeps what was typed (AC 5)", async () => {
    const onOpenChange = vi.fn();
    renderWithQuery(<AccountForm open onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByLabelText("Apelido"), { target: { value: "Conta cor ruim" } });
    fireEvent.change(screen.getByLabelText("Titulares"), { target: { value: "Gabriel" } });
    failures.set("POST /accounts", new ApiError("validation_error", "bad color", 422, "color"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));
    expect(await screen.findByText("Escolha uma cor da paleta.")).toBeInTheDocument();
    expect(screen.getByLabelText("Apelido")).toHaveValue("Conta cor ruim");
    expect(screen.getByLabelText("Titulares")).toHaveValue("Gabriel");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("another failure shows the mapped message and keeps the dialog open (AC 6)", async () => {
    const onOpenChange = vi.fn();
    renderWithQuery(<AccountForm open onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByLabelText("Apelido"), { target: { value: "Conta falha" } });
    fireEvent.change(screen.getByLabelText("Titulares"), { target: { value: "Gabriel" } });
    failures.set("POST /accounts", new ApiError("internal_error", "Server blew up", 500));
    fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));
    expect(await screen.findByText(GENERIC_ERROR)).toBeInTheDocument();
    expect(screen.queryByText("Escolha uma cor da paleta.")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("AccountsPage icon and color bar (ICON-03 AC 5, ICON-04 AC 8, 9)", () => {
  it("shows icon, nickname, bank label, color bar and the action buttons for each account", async () => {
    responses.set("GET /accounts", [
      base,
      { ...base, id: "acc-2", bank: "Neon", nickname: "Neon reserva", color: "sky-400" },
    ]);
    renderWithQuery(<AccountsPage />);
    const first = (await screen.findByRole("heading", { name: "Nubank pessoal" })).closest(
      "article",
    ) as HTMLElement;
    const second = screen
      .getByRole("heading", { name: "Neon reserva" })
      .closest("article") as HTMLElement;
    expect(first.querySelector("img")).toHaveAttribute("src", nubank);
    expect(first.querySelector("img")?.closest("span")).toHaveClass("size-8");
    expect(within(first).getByText("Nubank")).toBeInTheDocument();
    expect(barOf(first)).toHaveClass("bg-purple-400", "w-1.5");
    expect(second.querySelector("img")).toHaveAttribute("src", neon);
    expect(within(second).getByText("Neon")).toBeInTheDocument();
    expect(barOf(second)).toHaveClass("bg-sky-400");
    for (const article of [first, second]) {
      expect(within(article).getByRole("button", { name: "Editar" })).toBeInTheDocument();
      expect(within(article).getByRole("button", { name: "Desativar" })).toBeInTheDocument();
    }
  });

  it("shows Reativar and keeps opacity-55, icon and bar for an inactive account", async () => {
    responses.set("GET /accounts", [{ ...base, active: false, color: "lime-400" }]);
    renderWithQuery(<AccountsPage />);
    const article = (await screen.findByRole("heading", { name: "Nubank pessoal" })).closest(
      "article",
    ) as HTMLElement;
    expect(article).toHaveClass("opacity-55");
    expect(within(article).getByRole("button", { name: "Reativar" })).toBeInTheDocument();
    expect(article.querySelector("img")).toBeInTheDocument();
    expect(barOf(article)).toHaveClass("bg-lime-400");
  });

  it("after a PATCH of the color the list refetches and the bar shows the new class", async () => {
    let stored = base;
    responses.set("GET /accounts", () => [stored]);
    responses.set("PATCH /accounts/acc-1", () => {
      stored = { ...stored, color: "orange-400" };
      return stored;
    });
    renderWithQuery(<AccountsPage />);
    const heading = await screen.findByRole("heading", { name: "Nubank pessoal" });
    const article = heading.closest("article") as HTMLElement;
    expect(barOf(article)).toHaveClass("bg-purple-400");
    fireEvent.click(within(article).getByRole("button", { name: "Editar" }));
    await pickColor("Laranja");
    fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));
    await waitFor(() => {
      const current = screen.getByRole("heading", { name: "Nubank pessoal" }).closest("article");
      expect(barOf(current as HTMLElement)).toHaveClass("bg-orange-400");
    });
    expect(lastRequest("PATCH")?.body).toMatchObject({ color: "orange-400" });
  });
});

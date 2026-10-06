import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import neon from "@/assets/banks/neon.svg";
import nubank from "@/assets/banks/nubank.svg";
import sofisaDireto from "@/assets/banks/sofisa-direto.svg";
import xp from "@/assets/banks/xp.svg";
import { BankIcon } from "./BankIcon";
import { bankLabels } from "./bankLabels";

afterEach(cleanup);

const logos = { Nubank: nubank, SofisaDireto: sofisaDireto, Neon: neon, XP: xp } as const;
const frame = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe("BankIcon (ICON-02)", () => {
  it.each(Object.entries(logos))("%s renders its own svg in a 20 px frame (AC 1)", (bank, src) => {
    const { container } = render(<BankIcon bank={bank} />);
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", src);
    expect(frame(container)).toHaveClass("size-5", "rounded-md", "bg-white");
    expect(new Set(Object.values(logos)).size).toBe(4);
  });

  it("uses a 32 px frame with size lg (AC 1)", () => {
    const { container } = render(<BankIcon bank="Nubank" size="lg" />);
    expect(frame(container)).toHaveClass("size-8");
    expect(frame(container)).not.toHaveClass("size-5");
  });

  it.each(["Other", "Itau", ""])(
    "shows the generic icon for %j without throwing (AC 2)",
    (bank) => {
      const { container } = render(<BankIcon bank={bank} />);
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("svg.lucide-landmark")).not.toBeNull();
      expect(frame(container)).toHaveClass("size-5");
    },
  );

  it("is decorative by default: aria-hidden, empty alt, no img role (AC 3)", () => {
    const { container } = render(<BankIcon bank="Neon" />);
    expect(frame(container)).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it.each([
    ["Nubank", "Banco Nubank"],
    ["SofisaDireto", "Banco Sofisa Direto"],
    ["Neon", "Banco Neon"],
    ["XP", "Banco XP"],
    ["Other", "Banco Outro"],
    ["Desconhecido", "Banco Outro"],
  ])("with decorative=false %s is a role=img named %s (AC 4)", (bank, name) => {
    render(<BankIcon bank={bank} decorative={false} />);
    expect(screen.getByRole("img", { name })).toBeInTheDocument();
  });

  it("exposes the Portuguese bank labels", () => {
    expect(bankLabels).toEqual({
      Nubank: "Nubank",
      SofisaDireto: "Sofisa Direto",
      Neon: "Neon",
      XP: "XP",
      Other: "Outro",
    });
  });

  it("swaps a failed image for the generic icon and keeps the frame size (AC 5)", () => {
    const { container } = render(<BankIcon bank="XP" size="lg" />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg.lucide-landmark")).not.toBeNull();
    expect(frame(container)).toHaveClass("size-8");
  });
});

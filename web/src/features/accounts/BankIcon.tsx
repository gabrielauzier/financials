import { useState } from "react";
import { Landmark } from "lucide-react";
import neon from "@/assets/banks/neon.svg";
import nubank from "@/assets/banks/nubank.svg";
import sofisaDireto from "@/assets/banks/sofisa-direto.svg";
import xp from "@/assets/banks/xp.svg";
import type { Bank } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { bankLabels } from "./bankLabels";

const bankLogos: Partial<Record<string, string>> = {
  Nubank: nubank,
  SofisaDireto: sofisaDireto,
  Neon: neon,
  XP: xp,
};

type BankIconProps = {
  /** A known bank, or any other value (the generic icon is shown). */
  bank: string;
  size?: "sm" | "lg";
  /** Decorative by default: the account nickname next to it already names the account. */
  decorative?: boolean;
};

/**
 * Bank logo: a square svg with a full-bleed background fills the frame (`size-full`, no padding),
 * and the frame (`overflow-hidden rounded-md`, the same radius for every bank) rounds it. `Other`,
 * unknown banks and load errors show `Landmark` in the same frame.
 */
export function BankIcon({ bank, size = "sm", decorative = true }: BankIconProps) {
  const [failedBank, setFailedBank] = useState<string>();
  const logo = bankLogos[bank];
  const label = bankLabels[bank as Bank] ?? bankLabels.Other;
  const a11y = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": `Banco ${label}` } as const);
  const showLogo = logo && failedBank !== bank;
  return (
    <span
      {...a11y}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md",
        !showLogo && "bg-muted text-muted-foreground",
        size === "lg" ? "size-8" : "size-5",
      )}
    >
      {showLogo ? (
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          className="size-full"
          onError={() => setFailedBank(bank)}
        />
      ) : (
        <Landmark aria-hidden="true" className="size-3/4" />
      )}
    </span>
  );
}

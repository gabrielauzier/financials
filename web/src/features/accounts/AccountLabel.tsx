import type { Account } from "@/lib/api/types";
import { accentClasses } from "@/features/colors/palette";
import { cn } from "@/lib/utils";
import { BankIcon } from "./BankIcon";

type AccountLabelProps = {
  account: Pick<Account, "bank" | "nickname" | "active" | "color">;
  /** Appends " (inativa)" to the nickname (selects only, never the extrato). */
  showInactive?: boolean;
};

/** The only place that renders an account option or cell: bank icon, nickname and a color dot. */
export function AccountLabel({ account, showInactive = false }: AccountLabelProps) {
  const suffix = showInactive && !account.active ? " (inativa)" : "";
  return (
    <span className="flex min-w-0 items-center gap-2">
      <BankIcon bank={account.bank} />
      <span className="truncate">{`${account.nickname}${suffix}`}</span>
      <span
        aria-hidden="true"
        className={cn("size-2.5 shrink-0 rounded-full", accentClasses(account.color).bg)}
      />
    </span>
  );
}

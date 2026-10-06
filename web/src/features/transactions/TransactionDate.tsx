import { formatDateLocal } from "@/lib/format";
import { weekdayAbbrev } from "./utils";

/** The date of a transaction with its weekday under it, smaller and lighter; nothing under it for an invalid instant. */
export function TransactionDate({ occurredAt }: { occurredAt: string }) {
  const weekday = weekdayAbbrev(occurredAt);
  return (
    <div>
      <div data-testid="transaction-date" className="text-foreground">
        {formatDateLocal(occurredAt)}
      </div>
      {weekday && (
        <div data-testid="transaction-weekday" className="text-xs text-muted-foreground">
          {weekday}
        </div>
      )}
    </div>
  );
}

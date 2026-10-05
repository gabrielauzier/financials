import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { messageForError } from "@/lib/api/errorMessages";
import type { CreditExpense, CreditExpenseStatus } from "@/lib/api/types";
import { useUpdateCreditExpense } from "./hooks";
import { creditExpenseStatuses, creditExpenseStatusLabels } from "./labels";

/** Offers every status from any current one: status changes are manual, with no transition rules. */
export function StatusSelect({ expense }: { expense: CreditExpense }) {
  const update = useUpdateCreditExpense();
  const [error, setError] = useState("");
  const change = (status: string) => {
    setError("");
    update.mutate(
      { id: expense.id, input: { status: status as CreditExpenseStatus } },
      { onError: (reason) => setError(messageForError(reason, "creditExpense")) },
    );
  };
  return (
    <div className="space-y-1">
      <Select value={expense.status} onValueChange={change}>
        <SelectTrigger aria-label={`Status de ${expense.name}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {creditExpenseStatuses.map((value) => (
            <SelectItem key={value} value={value}>
              {creditExpenseStatusLabels[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

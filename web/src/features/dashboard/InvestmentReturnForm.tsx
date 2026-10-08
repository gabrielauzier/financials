import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AccountSelect } from "@/features/accounts/AccountSelect";
import { toLocalDateInput } from "@/features/transactions/utils";
import { fieldForError, messageForError } from "@/lib/api/errorMessages";
import type { InvestmentReturn, InvestmentReturnInput } from "@/lib/api/types";
import { useCreateInvestmentReturn, useUpdateInvestmentReturn } from "./hooks";
import { parseSignedBRLToDecimal } from "./money";

const INVALID_AMOUNT = "Valor inválido";
const formFields = new Set(["amount", "occurredOn", "accountId", "notes"]);

const initial = () => ({
  date: toLocalDateInput(new Date().toISOString()),
  accountId: "",
  amount: "",
  notes: "",
});

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investmentReturn?: InvestmentReturn;
};

export function InvestmentReturnForm({ open, onOpenChange, investmentReturn }: Props) {
  const create = useCreateInvestmentReturn();
  const update = useUpdateInvestmentReturn();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      investmentReturn
        ? {
            date: investmentReturn.occurredOn,
            accountId: investmentReturn.accountId,
            amount: investmentReturn.amount.replace(".", ","),
            notes: investmentReturn.notes ?? "",
          }
        : initial(),
    );
  }, [open, investmentReturn]);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    const amount = form.amount.trim() ? parseSignedBRLToDecimal(form.amount) : null;
    if (!form.amount.trim()) next["amount"] = "Informe o valor";
    else if (!amount) next["amount"] = INVALID_AMOUNT;
    if (!form.date) next["occurredOn"] = "Informe a data";
    if (!form.accountId) next["accountId"] = "Informe a conta";
    setErrors(next);
    if (Object.keys(next).length || !amount) return;

    const notes = form.notes.trim();
    const input: InvestmentReturnInput = {
      occurredOn: form.date,
      amount,
      accountId: form.accountId,
      ...(notes ? { notes } : {}),
    };
    try {
      if (investmentReturn) {
        // PATCH only clears notes when they are sent as null
        await update.mutateAsync({
          id: investmentReturn.id,
          input: { ...input, notes: notes || null },
        });
      } else await create.mutateAsync(input);
      onOpenChange(false);
    } catch (reason) {
      const field = fieldForError(reason);
      setErrors({
        [field && formFields.has(field) ? field : "form"]: messageForError(
          reason,
          "investmentReturn",
        ),
      });
    }
  };
  const pending = create.isPending || update.isPending;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{investmentReturn ? "Editar rendimento" : "Novo rendimento"}</DialogTitle>
          <DialogDescription>
            Informe o ganho (positivo) ou a perda (negativo) do período.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Field label="Data" id="investment-return-date" error={errors["occurredOn"]}>
            <DatePicker
              id="investment-return-date"
              value={form.date}
              onChange={(value) => set("date", value)}
            />
          </Field>
          <Field label="Conta" id="investment-return-account" error={errors["accountId"]}>
            <AccountSelect
              id="investment-return-account"
              includeInactive
              value={form.accountId}
              onChange={(value) => set("accountId", value)}
            />
          </Field>
          <Field label="Valor" id="investment-return-amount" error={errors["amount"]}>
            <Input
              id="investment-return-amount"
              inputMode="decimal"
              placeholder="-1.234,56"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
            />
          </Field>
          <Field label="Observações" id="investment-return-notes" error={errors["notes"]}>
            <Textarea
              id="investment-return-notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
          {errors["form"] && (
            <p role="alert" className="text-sm text-destructive">
              {errors["form"]}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

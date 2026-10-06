import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AccountSelect } from "@/features/accounts/AccountSelect";
import { CategorySelect } from "@/features/categories/CategorySelect";
import { useCategories } from "@/features/categories/hooks";
import { parseBRLToDecimal, toLocalDateInput } from "@/features/transactions/utils";
import { fieldForError, messageForError } from "@/lib/api/errorMessages";
import type { CreditExpense, CreditExpenseInput, CreditExpenseStatus } from "@/lib/api/types";
import { useCreateCreditExpense, useUpdateCreditExpense } from "./hooks";
import { creditExpenseStatuses, creditExpenseStatusLabels } from "./labels";

const initial = () => ({
  name: "",
  totalAmount: "",
  paidAmount: "",
  date: new Date().toISOString().slice(0, 10),
  recurrencyDay: "",
  status: "Active" as CreditExpenseStatus,
  accountId: "",
  categoryId: "",
  notes: "",
});

const formFields = new Set([
  "name",
  "totalAmount",
  "paidAmount",
  "date",
  "recurrencyDay",
  "status",
  "accountId",
  "categoryId",
]);

const INVALID_TOTAL = "Valor total inválido";
const INVALID_PAID = "Valor pago inválido";
const INVALID_DAY = "Dia inválido (use de 1 a 31)";

// Money stays a string: the digits are compared as integer cents, never as floats.
const withTwoDecimals = (decimal: string) => (decimal.includes(".") ? decimal : `${decimal}.00`);
const toCents = (decimal: string) => {
  const [integer = "0", fraction = ""] = decimal.split(".");
  return BigInt(integer) * 100n + BigInt(fraction.padEnd(2, "0"));
};
// Unlike the total, the paid amount accepts empty and zero.
function parsePaid(value: string): string | null {
  const clean = value.trim().replace(/\s/g, "");
  if (clean === "" || /^0+(?:,0{1,2})?$/.test(clean)) return "0.00";
  const decimal = parseBRLToDecimal(clean);
  return decimal === null ? null : withTwoDecimals(decimal);
}
function parseDay(value: string): number | null {
  const clean = value.trim();
  if (!/^\d+$/.test(clean)) return null;
  const day = Number(clean);
  return day >= 1 && day <= 31 ? day : null;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: CreditExpense;
};

export function CreditExpenseForm({ open, onOpenChange, expense }: Props) {
  const create = useCreateCreditExpense();
  const update = useUpdateCreditExpense();
  const { data: categories = [] } = useCategories();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      expense
        ? {
            name: expense.name,
            totalAmount: expense.totalAmount.replace(".", ","),
            paidAmount: expense.paidAmount.replace(".", ","),
            date: toLocalDateInput(expense.occurredAt),
            recurrencyDay: String(expense.recurrencyDay),
            status: expense.status,
            accountId: expense.accountId,
            categoryId: expense.categoryId,
            notes: expense.notes ?? "",
          }
        : initial(),
    );
  }, [open, expense]);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next["name"] = "Informe o nome";
    const parsedTotal = form.totalAmount.trim() ? parseBRLToDecimal(form.totalAmount) : null;
    const totalAmount = parsedTotal === null ? null : withTwoDecimals(parsedTotal);
    if (!form.totalAmount.trim()) next["totalAmount"] = "Informe o valor total";
    else if (!totalAmount) next["totalAmount"] = INVALID_TOTAL;
    const paidAmount = parsePaid(form.paidAmount);
    if (!paidAmount || (totalAmount && toCents(paidAmount) > toCents(totalAmount)))
      next["paidAmount"] = INVALID_PAID;
    if (!form.date) next["date"] = "Informe a data";
    const recurrencyDay = parseDay(form.recurrencyDay);
    if (!form.recurrencyDay.trim()) next["recurrencyDay"] = "Informe o dia da fatura";
    else if (recurrencyDay === null) next["recurrencyDay"] = INVALID_DAY;
    if (!form.status) next["status"] = "Informe o status";
    if (!form.accountId) next["accountId"] = "Informe a conta";
    setErrors(next);
    if (Object.keys(next).length || !totalAmount || !paidAmount || recurrencyDay === null) return;

    const notes = form.notes.trim();
    const input: CreditExpenseInput = {
      name: form.name.trim(),
      totalAmount,
      occurredAt: new Date(`${form.date}T12:00:00`).toISOString(),
      recurrencyDay,
      status: form.status,
      accountId: form.accountId,
      ...(form.paidAmount.trim() || expense ? { paidAmount } : {}),
      ...(form.categoryId ? { categoryId: form.categoryId } : {}),
      ...(notes ? { notes } : {}),
    };
    try {
      if (expense) {
        // PATCH only clears notes when they are sent as null
        await update.mutateAsync({ id: expense.id, input: { ...input, notes: notes || null } });
      } else await create.mutateAsync(input);
      onOpenChange(false);
    } catch (reason) {
      const apiField = fieldForError(reason);
      const field = apiField === "occurredAt" ? "date" : apiField;
      setErrors({
        [field && formFields.has(field) ? field : "form"]: messageForError(reason, "creditExpense"),
      });
    }
  };
  const pending = create.isPending || update.isPending;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {expense ? "Editar despesa de cartão" : "Nova despesa de cartão"}
          </DialogTitle>
          <DialogDescription>Preencha os dados da despesa de cartão.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Nome" id="credit-expense-name" error={errors["name"]}>
            <Input
              id="credit-expense-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Valor total" id="credit-expense-total" error={errors["totalAmount"]}>
            <Input
              id="credit-expense-total"
              inputMode="decimal"
              placeholder="0,00"
              value={form.totalAmount}
              onChange={(e) => set("totalAmount", e.target.value)}
            />
          </Field>
          <Field label="Valor já pago" id="credit-expense-paid" error={errors["paidAmount"]}>
            <Input
              id="credit-expense-paid"
              inputMode="decimal"
              placeholder="0,00"
              value={form.paidAmount}
              onChange={(e) => set("paidAmount", e.target.value)}
            />
          </Field>
          <Field label="Data" id="credit-expense-date" error={errors["date"]}>
            <Input
              id="credit-expense-date"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          <Field label="Dia da fatura" id="credit-expense-day" error={errors["recurrencyDay"]}>
            <Input
              id="credit-expense-day"
              inputMode="numeric"
              placeholder="1 a 31"
              value={form.recurrencyDay}
              onChange={(e) => set("recurrencyDay", e.target.value)}
            />
          </Field>
          <Field label="Status" id="credit-expense-status" error={errors["status"]}>
            <Select
              value={form.status}
              onValueChange={(value) => set("status", value as CreditExpenseStatus)}
            >
              <SelectTrigger id="credit-expense-status">
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
          </Field>
          <Field label="Conta" id="credit-expense-account" error={errors["accountId"]}>
            <AccountSelect
              id="credit-expense-account"
              includeInactive={Boolean(expense)}
              value={form.accountId}
              onChange={(value) => set("accountId", value)}
            />
          </Field>
          <Field label="Categoria" id="credit-expense-category" error={errors["categoryId"]}>
            <CategorySelect
              id="credit-expense-category"
              value={
                form.categoryId ||
                categories.find((category) => category.key === "Uncategorized")?.id
              }
              onChange={(value) => set("categoryId", value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observações" id="credit-expense-notes">
              <Textarea
                id="credit-expense-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </div>
          {errors["form"] && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {errors["form"]}
            </p>
          )}
          <DialogFooter className="sm:col-span-2">
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

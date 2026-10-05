import { useEffect, useState, type FormEvent } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AccountSelect } from "@/features/accounts/AccountSelect";
import { CategorySelect } from "@/features/categories/CategorySelect";
import { useCategories } from "@/features/categories/hooks";
import type {
  PaymentMethod,
  Transaction,
  TransactionInput,
  TransactionType,
} from "@/lib/api/types";
import { useCreateTransaction, useUpdateTransaction } from "./hooks";
import { parseBRLToDecimal } from "./utils";

const paymentLabels: Record<PaymentMethod, string> = {
  BankTransfer: "Transferência bancária",
  Boleto: "Boleto",
  Cash: "Dinheiro",
  CreditCard: "Cartão de crédito",
  DebitCard: "Cartão de débito",
  NuPay: "NuPay",
  PIX: "PIX",
};
const toLocalInput = (iso: string) => iso.slice(0, 10);
const initial = {
  name: "",
  type: "Expense" as TransactionType,
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  accountId: "",
  categoryId: "",
  paymentMethod: "PIX" as PaymentMethod,
  notes: "",
  receipt: "",
  neutral: false,
};

type Props = { open: boolean; onOpenChange: (open: boolean) => void; transaction?: Transaction };
export function TransactionForm({ open, onOpenChange, transaction }: Props) {
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const { data: categories = [] } = useCategories();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      transaction
        ? {
            name: transaction.name,
            type: transaction.type,
            date: toLocalInput(transaction.occurredAt),
            amount: transaction.amount.replace(".", ","),
            accountId: transaction.accountId,
            categoryId: transaction.categoryId,
            paymentMethod: transaction.paymentMethod,
            notes: transaction.notes ?? "",
            receipt: transaction.receipt ?? "",
            neutral: transaction.neutral,
          }
        : initial,
    );
  }, [open, transaction]);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next["name"] = "Informe o nome";
    if (!form.type) next["type"] = "Informe o tipo";
    if (!form.date) next["date"] = "Informe a data";
    const amount = parseBRLToDecimal(form.amount);
    if (!amount) next["amount"] = "Valor inválido";
    if (!form.accountId) next["accountId"] = "Informe a conta";
    if (!form.paymentMethod) next["paymentMethod"] = "Informe o método de pagamento";
    if (form.receipt.trim() && !/^https?:\/\//i.test(form.receipt.trim()))
      next["receipt"] = "URL inválida";
    setErrors(next);
    if (Object.keys(next).length || !amount) return;
    const fallbackCategory = categories.find((category) => category.key === "Uncategorized")?.id;
    const categoryId = form.categoryId || fallbackCategory;
    const input: TransactionInput = {
      name: form.name.trim(),
      type: form.type,
      occurredAt: new Date(`${form.date}T12:00:00`).toISOString(),
      amount,
      accountId: form.accountId,
      paymentMethod: form.paymentMethod,
      neutral: form.neutral,
      ...(categoryId ? { categoryId } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      ...(form.receipt.trim() ? { receipt: form.receipt.trim() } : {}),
    };
    try {
      if (transaction) await update.mutateAsync({ id: transaction.id, input });
      else await create.mutateAsync(input);
      onOpenChange(false);
    } catch (reason) {
      const field =
        typeof reason === "object" && reason && "field" in reason ? String(reason.field) : "form";
      const code =
        typeof reason === "object" && reason && "code" in reason ? String(reason.code) : "";
      setErrors({
        [field]:
          code === "invalid_amount"
            ? "Valor inválido"
            : code === "invalid_account"
              ? "Conta inválida"
              : code === "invalid_receipt_url"
                ? "URL inválida"
                : reason instanceof Error
                  ? reason.message
                  : "Não foi possível salvar a transação",
      });
    }
  };
  const pending = create.isPending || update.isPending;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{transaction ? "Editar transação" : "Nova transação"}</DialogTitle>
          <DialogDescription>Preencha os dados do lançamento.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Nome" id="transaction-name" error={errors["name"]}>
            <Input
              id="transaction-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Tipo" id="transaction-type" error={errors["type"]}>
            <Select
              value={form.type}
              onValueChange={(value) => set("type", value as TransactionType)}
            >
              <SelectTrigger id="transaction-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Income">Receita</SelectItem>
                <SelectItem value="Expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Data" id="transaction-date" error={errors["date"]}>
            <Input
              id="transaction-date"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          <Field label="Valor" id="transaction-amount" error={errors["amount"]}>
            <Input
              id="transaction-amount"
              inputMode="decimal"
              placeholder="0,00"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
            />
          </Field>
          <Field label="Conta" id="transaction-account" error={errors["accountId"]}>
            <AccountSelect
              id="transaction-account"
              value={form.accountId}
              onChange={(value) => set("accountId", value)}
            />
          </Field>
          <Field
            label="Método de pagamento"
            id="transaction-method"
            error={errors["paymentMethod"]}
          >
            <Select
              value={form.paymentMethod}
              onValueChange={(value) => set("paymentMethod", value as PaymentMethod)}
            >
              <SelectTrigger id="transaction-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(paymentLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Categoria" id="transaction-category">
            <CategorySelect
              id="transaction-category"
              value={
                form.categoryId ||
                categories.find((category) => category.key === "Uncategorized")?.id
              }
              onChange={(value) => set("categoryId", value)}
            />
          </Field>
          <Field label="Recibo (URL)" id="transaction-receipt" error={errors["receipt"]}>
            <Input
              id="transaction-receipt"
              type="url"
              value={form.receipt}
              onChange={(e) => set("receipt", e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observações" id="transaction-notes">
              <Textarea
                id="transaction-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch
              id="transaction-neutral"
              checked={form.neutral}
              onCheckedChange={(value) => set("neutral", value)}
            />
            <Label htmlFor="transaction-neutral">Neutra</Label>
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
  children: React.ReactNode;
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

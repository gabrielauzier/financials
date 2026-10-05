import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { z } from "zod";
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
import type { Account, AccountInput, Bank } from "@/lib/api/types";
import { useCreateAccount, useUpdateAccount } from "./hooks";

const banks: Array<{ value: Bank; label: string }> = [
  { value: "Nubank", label: "Nubank" },
  { value: "SofisaDireto", label: "Sofisa Direto" },
  { value: "Neon", label: "Neon" },
  { value: "XP", label: "XP" },
  { value: "Other", label: "Outro" },
];
const schema = z.object({
  bank: z.enum(["Nubank", "SofisaDireto", "Neon", "XP", "Other"]),
  nickname: z.string().trim().min(1).max(100),
  holderNames: z.array(z.string().trim().min(1).max(150)).min(1),
});

export function AccountForm({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account;
}) {
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const [bank, setBank] = useState<Bank>("Nubank");
  const [nickname, setNickname] = useState("");
  const [holder, setHolder] = useState("");
  const [holders, setHolders] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [holderError, setHolderError] = useState("");
  useEffect(() => {
    if (!open) return;
    setBank(account?.bank ?? "Nubank");
    setNickname(account?.nickname ?? "");
    setHolders(account?.holderNames ?? []);
    setHolder("");
    setError("");
    setHolderError("");
  }, [account, open]);
  const addHolder = () => {
    const clean = holder.trim();
    if (!clean) return;
    if (holders.some((name) => name.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
      setHolderError("Titular já informado");
      return;
    }
    setHolders([...holders, clean]);
    setHolder("");
    setHolderError("");
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addHolder();
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setHolderError("");
    const pendingHolders = holder.trim() ? [...holders, holder.trim()] : holders;
    const normalizedHolders = pendingHolders.map((name) => name.toLocaleLowerCase());
    const result = schema.safeParse({ bank, nickname, holderNames: pendingHolders });
    if (!nickname.trim()) {
      setError("Informe o apelido");
      return;
    }
    if (pendingHolders.length === 0) {
      setHolderError("Informe ao menos um titular");
      return;
    }
    if (new Set(normalizedHolders).size !== normalizedHolders.length) {
      setHolderError("Titular já informado");
      return;
    }
    if (!result.success) {
      setError("Não foi possível salvar a conta");
      return;
    }
    const input: AccountInput = result.data;
    try {
      if (account) await update.mutateAsync({ id: account.id, input });
      else await create.mutateAsync(input);
      onOpenChange(false);
    } catch (reason) {
      const code =
        typeof reason === "object" && reason && "code" in reason ? String(reason.code) : "";
      if (code === "duplicate_name") setError("Já existe uma conta com esse apelido");
      else if (code === "holder_required") setHolderError("Informe ao menos um titular");
      else setError(reason instanceof Error ? reason.message : "Não foi possível salvar a conta");
    }
  };
  const busy = create.isPending || update.isPending;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{account ? "Editar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>
            Informe como esta conta deve aparecer no Financials.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="account-bank">Banco</Label>
            <Select value={bank} onValueChange={(value: Bank) => setBank(value)}>
              <SelectTrigger id="account-bank" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {banks.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-nickname">Apelido</Label>
            <Input
              id="account-nickname"
              value={nickname}
              maxLength={100}
              onChange={(event) => setNickname(event.target.value)}
              aria-describedby={error ? "account-error" : undefined}
            />
            {error && (
              <p id="account-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-holder">Titulares</Label>
            <div className="flex gap-2">
              <Input
                id="account-holder"
                value={holder}
                maxLength={150}
                placeholder="Digite e pressione Enter"
                onChange={(event) => {
                  setHolder(event.target.value);
                  setHolderError("");
                }}
                onKeyDown={keyDown}
                aria-describedby={holderError ? "holder-error" : "holder-help"}
              />
              <Button type="button" variant="secondary" onClick={addHolder}>
                Adicionar
              </Button>
            </div>
            <p id="holder-help" className="text-xs text-muted-foreground">
              Adicione uma pessoa ou empresa por vez.
            </p>
            {holders.length > 0 && (
              <div className="flex flex-wrap gap-2" aria-label="Titulares informados">
                {holders.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
                  >
                    {name}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover ${name}`}
                      className="size-5 rounded-full"
                      onClick={() => setHolders(holders.filter((item) => item !== name))}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </span>
                ))}
              </div>
            )}
            {holderError && (
              <p id="holder-error" role="alert" className="text-sm text-destructive">
                {holderError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={busy}>{busy ? "Salvando…" : "Salvar conta"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

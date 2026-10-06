import { useState } from "react";
import { Landmark, Pencil, Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { messageForError } from "@/lib/api/errorMessages";
import type { Account } from "@/lib/api/types";
import { accentClasses } from "@/features/colors/palette";
import { cn } from "@/lib/utils";
import { AccountForm } from "./AccountForm";
import { BankIcon } from "./BankIcon";
import { bankLabels } from "./bankLabels";
import { useAccounts, useSetAccountActive } from "./hooks";

export function AccountsPage() {
  const { data = [], isLoading, isError, refetch } = useAccounts();
  const statusMutation = useSetAccountActive();
  const [editing, setEditing] = useState<Account>();
  const [formOpen, setFormOpen] = useState(false);
  const [confirming, setConfirming] = useState<Account>();
  const [statusError, setStatusError] = useState("");
  const changeStatus = async () => {
    if (!confirming) return;
    setStatusError("");
    try {
      await statusMutation.mutateAsync({ id: confirming.id, active: !confirming.active });
      setConfirming(undefined);
    } catch (reason) {
      setStatusError(messageForError(reason, "account"));
    }
  };
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-4 border-b pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent-foreground">Organização financeira</p>
          <h1 className="mt-1 text-3xl font-semibold">Contas</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Contas desativadas continuam no extrato e nos cálculos, mas não podem receber novas
            transações.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus />
          Nova conta
        </Button>
      </div>
      <section className="mt-8" aria-label="Contas cadastradas">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando contas…</p>}
        {isError && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-destructive">Não foi possível carregar as contas.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}
        {!isLoading && !isError && data.length === 0 && (
          <div className="border-y py-12 text-center">
            <Landmark className="mx-auto mb-4 size-8 text-muted-foreground" />
            <p className="font-medium">Nenhuma conta cadastrada.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre uma conta para começar a importar extratos.
            </p>
          </div>
        )}
        <div className="divide-y border-y">
          {data.map((account) => (
            <article
              key={account.id}
              className={cn("flex gap-4 py-5", !account.active && "opacity-55")}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "w-1.5 shrink-0 self-stretch rounded-full",
                  accentClasses(account.color).bg,
                )}
              />
              <div className="grid flex-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <BankIcon bank={account.bank} size="lg" />
                    <h2 className="font-semibold">{account.nickname}</h2>
                    <Badge variant={account.active ? "default" : "secondary"}>
                      {account.active ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{bankLabels[account.bank]}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {account.holderNames.map((holder) => (
                      <Badge key={holder} variant="outline">
                        {holder}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(account);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatusError("");
                      setConfirming(account);
                    }}
                  >
                    {account.active ? "Desativar" : "Reativar"}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <AccountForm
        open={formOpen}
        onOpenChange={setFormOpen}
        {...(editing ? { account: editing } : {})}
      />
      <AlertDialog
        open={Boolean(confirming)}
        onOpenChange={(open) => !open && setConfirming(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming?.active ? "Desativar conta?" : "Reativar conta?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.active
                ? "Ela continuará no histórico, mas não receberá novas transações."
                : "Ela voltará a ficar disponível para novas transações."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {statusError && (
            <p role="alert" className="text-sm text-destructive">
              {statusError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void changeStatus();
              }}
            >
              {confirming?.active ? "Desativar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

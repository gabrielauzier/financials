import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SavedFilter, SavedFilterResult } from "./savedFilters";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gets the focus back when the dialog closes: the "Filtros salvos" button is not this dialog's trigger. */
  returnFocusRef: RefObject<HTMLElement | null>;
  filters: SavedFilter[];
  /** A storage failure is reported by the caller (toast); the other refusals show under the field. */
  onRename: (id: string, name: string) => SavedFilterResult;
  onDelete: (id: string) => SavedFilterResult;
};

/** Renames (in the row) and deletes (after a confirmation) the saved filters. */
export function ManageFiltersDialog({
  open,
  onOpenChange,
  returnFocusRef,
  filters,
  onRename,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string>();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState<SavedFilter>();
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setEditingId(undefined);
      setError(undefined);
    }
  }, [open]);
  useEffect(() => {
    if (editingId === undefined) return;
    field.current?.focus();
    field.current?.select();
  }, [editingId]);

  const startRename = (filter: SavedFilter) => {
    setEditingId(filter.id);
    setDraft(filter.name);
    setError(undefined);
  };
  const cancelRename = () => {
    setEditingId(undefined);
    setError(undefined);
  };
  const confirmRename = (id: string) => {
    const result = onRename(id, draft);
    if (result.ok) {
      cancelRename();
      return;
    }
    // the caller already told about a storage failure; the editing stays with the typed name
    if (result.reason === "storage") return;
    setError(result.message);
    field.current?.focus();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            // Esc ends the editing of a name first; the dialog closes on the next one
            if (editingId === undefined) return;
            event.preventDefault();
            cancelRename();
          }}
        >
          <DialogHeader>
            <DialogTitle>Gerenciar filtros</DialogTitle>
            <DialogDescription>
              Renomeie ou exclua os filtros salvos neste navegador.
            </DialogDescription>
          </DialogHeader>
          {filters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum filtro salvo ainda</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {filters.map((filter) => (
                <li key={filter.id} className="flex flex-col gap-2 p-2">
                  {editingId === filter.id ? (
                    <>
                      <Input
                        ref={field}
                        aria-label={`Novo nome de ${filter.name}`}
                        value={draft}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? "manage-filter-error" : undefined}
                        onChange={(event) => {
                          setDraft(event.target.value);
                          setError(undefined);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          confirmRename(filter.id);
                        }}
                      />
                      {error && (
                        <p
                          id="manage-filter-error"
                          role="alert"
                          className="text-sm text-destructive"
                        >
                          {error}
                        </p>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={cancelRename}>
                          Cancelar
                        </Button>
                        <Button type="button" size="sm" onClick={() => confirmRename(filter.id)}>
                          Salvar nome
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm">{filter.name}</span>
                      <div className="flex shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Renomear ${filter.name}`}
                          onClick={() => startRename(filter)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Excluir ${filter.name}`}
                          onClick={() => setDeleting(filter)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(next) => !next && setDeleting(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`Excluir o filtro "${deleting?.name ?? ""}"?`}</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // keep the confirmation open when the delete fails, so the user can retry or cancel
                event.preventDefault();
                if (!deleting) return;
                const result = onDelete(deleting.id);
                if (result.ok || result.reason === "not-found") setDeleting(undefined);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

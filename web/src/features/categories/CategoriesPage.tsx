import { useState, type FormEvent } from "react";
import { Check, LockKeyhole, Pencil, Plus, Trash2, X } from "lucide-react";
import { z } from "zod";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Category } from "@/lib/api/types";
import { CategorySelect } from "./CategorySelect";
import { useCategories, useCreateCategory, useDeleteCategory, useRenameCategory } from "./hooks";

const nameSchema = z.string().trim().min(1).max(100);
const getCode = (reason: unknown) =>
  typeof reason === "object" && reason && "code" in reason ? String(reason.code) : "";

export function CategoriesPage() {
  const { data = [], isLoading, isError, refetch } = useCategories();
  const create = useCreateCategory();
  const rename = useRenameCategory();
  const remove = useDeleteCategory();
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState("");
  const [editing, setEditing] = useState<Category>();
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [deleting, setDeleting] = useState<Category>();
  const [reassigning, setReassigning] = useState<Category>();
  const [destination, setDestination] = useState<string>();
  const [deleteError, setDeleteError] = useState("");
  const submitNew = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError("");
    const parsed = nameSchema.safeParse(newName);
    if (!parsed.success) {
      setCreateError("Informe o nome");
      return;
    }
    try {
      await create.mutateAsync(parsed.data);
      setNewName("");
    } catch (reason) {
      setCreateError(
        getCode(reason) === "duplicate_name"
          ? "Já existe uma categoria com esse nome"
          : reason instanceof Error
            ? reason.message
            : "Não foi possível criar a categoria",
      );
    }
  };
  const submitRename = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setEditError("");
    const parsed = nameSchema.safeParse(editName);
    if (!parsed.success) {
      setEditError("Informe o nome");
      return;
    }
    try {
      await rename.mutateAsync({ id: editing.id, name: parsed.data });
      setEditing(undefined);
    } catch (reason) {
      const code = getCode(reason);
      setEditError(
        code === "duplicate_name"
          ? "Já existe uma categoria com esse nome"
          : code === "category_protected"
            ? "Categoria protegida"
            : reason instanceof Error
              ? reason.message
              : "Não foi possível renomear a categoria",
      );
    }
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    const category = deleting;
    setDeleteError("");
    try {
      await remove.mutateAsync({ id: category.id });
      setDeleting(undefined);
    } catch (reason) {
      setDeleting(undefined);
      if (getCode(reason) === "reassign_required") {
        setDestination(undefined);
        setReassigning(category);
      } else
        setDeleteError(
          reason instanceof Error ? reason.message : "Não foi possível excluir a categoria",
        );
    }
  };
  const confirmReassignment = async () => {
    if (!reassigning || !destination) return;
    setDeleteError("");
    try {
      await remove.mutateAsync({ id: reassigning.id, reassignTo: destination });
      setReassigning(undefined);
      setDestination(undefined);
    } catch (reason) {
      setDeleteError(
        reason instanceof Error ? reason.message : "Não foi possível excluir a categoria",
      );
    }
  };
  return (
    <TooltipProvider>
      <div className="mx-auto max-w-4xl">
        <div className="border-b pb-7">
          <p className="text-sm font-medium text-accent-foreground">Classificação</p>
          <h1 className="mt-1 text-3xl font-semibold">Categorias</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Organize lançamentos com nomes fáceis de reconhecer.
          </p>
        </div>
        <form
          onSubmit={submitNew}
          className="mt-7 flex flex-col gap-3 border-b pb-7 sm:flex-row sm:items-start"
          noValidate
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="new-category">Nova categoria</Label>
            <Input
              id="new-category"
              value={newName}
              maxLength={100}
              placeholder="Nome da categoria"
              onChange={(event) => {
                setNewName(event.target.value);
                setCreateError("");
              }}
              aria-describedby={createError ? "new-category-error" : undefined}
            />
            {createError && (
              <p id="new-category-error" role="alert" className="text-sm text-destructive">
                {createError}
              </p>
            )}
          </div>
          <Button className="sm:mt-7" disabled={create.isPending}>
            <Plus />
            {create.isPending ? "Criando…" : "Nova categoria"}
          </Button>
        </form>
        <section className="mt-7" aria-label="Categorias cadastradas">
          {deleteError && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {deleteError}
            </p>
          )}
          {isLoading && <p className="text-sm text-muted-foreground">Carregando categorias…</p>}
          {isError && (
            <div className="flex items-center gap-3">
              <p className="text-sm text-destructive">Não foi possível carregar as categorias.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}
          <div className="divide-y border-y">
            {data.map((category) => (
              <div
                key={category.id}
                className="flex min-h-16 items-center justify-between gap-3 py-3"
              >
                {editing?.id === category.id ? (
                  <form
                    onSubmit={submitRename}
                    className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start"
                    noValidate
                  >
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={`category-${category.id}`} className="sr-only">
                        Nome da categoria
                      </Label>
                      <Input
                        id={`category-${category.id}`}
                        autoFocus
                        value={editName}
                        maxLength={100}
                        onChange={(event) => {
                          setEditName(event.target.value);
                          setEditError("");
                        }}
                        aria-describedby={editError ? `category-error-${category.id}` : undefined}
                      />
                      {editError && (
                        <p
                          id={`category-error-${category.id}`}
                          role="alert"
                          className="mt-1 text-sm text-destructive"
                        >
                          {editError}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" aria-label="Salvar nome">
                        <Check />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Cancelar edição"
                        onClick={() => setEditing(undefined)}
                      >
                        <X />
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{category.name}</span>
                      {category.isSystem && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0} aria-label="Categoria de sistema">
                              <LockKeyhole className="size-4 text-muted-foreground" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Categoria de sistema: não pode ser alterada
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {!category.isSystem && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Renomear ${category.name}`}
                          onClick={() => {
                            setEditing(category);
                            setEditName(category.name);
                            setEditError("");
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Excluir ${category.name}`}
                          onClick={() => {
                            setDeleting(category);
                            setDeleteError("");
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
        <AlertDialog
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(undefined)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
              <AlertDialogDescription>
                A categoria “{deleting?.name}” será removida. Se houver transações nela, você poderá
                escolher um destino.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Dialog
          open={Boolean(reassigning)}
          onOpenChange={(open) => !open && setReassigning(undefined)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Esta categoria está em uso.</DialogTitle>
              <DialogDescription>Escolha para qual categoria mover as transações</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="category-destination">Categoria de destino</Label>
              <CategorySelect
                id="category-destination"
                value={destination}
                onChange={setDestination}
                excludeId={reassigning?.id}
              />
              {deleteError && (
                <p role="alert" className="text-sm text-destructive">
                  {deleteError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReassigning(undefined)}>
                Cancelar
              </Button>
              <Button onClick={confirmReassignment} disabled={!destination || remove.isPending}>
                {remove.isPending ? "Movendo…" : "Mover e excluir"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

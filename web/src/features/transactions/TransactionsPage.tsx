import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccountSelect } from "@/features/accounts/AccountSelect";
import { CategorySelect } from "@/features/categories/CategorySelect";
import { formatBRL, formatDateLocal } from "@/lib/format";
import { messageForError } from "@/lib/api/errorMessages";
import type { Transaction, TransactionFilters } from "@/lib/api/types";
import {
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
  useUpdateTransactionCategories,
} from "./hooks";
import { paymentMethodLabels, transactionTypeLabels } from "./labels";
import { TransactionForm } from "./TransactionForm";

type Sort = NonNullable<TransactionFilters["sort"]>;
const baseFilters: TransactionFilters = { sort: "date", order: "desc", page: 1 };

export function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>(baseFilters);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [editing, setEditing] = useState<Transaction>();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Transaction>();
  const [actionError, setActionError] = useState("");
  const invalidPeriod = Boolean(filters.from && filters.to && filters.from > filters.to);
  const { data, isLoading, isError, refetch } = useTransactions(filters, !invalidPeriod);
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const bulk = useUpdateTransactionCategories();
  const items = data?.items ?? [];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = search.trim();
      setFilters((current) => {
        const next = { ...current, page: 1 };
        if (query) next.q = query;
        else delete next.q;
        return next;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => setSelected(new Set()), [filters]);

  const changeFilter = <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) =>
    setFilters((current) => {
      const next = { ...current, page: 1 };
      if (value === undefined || value === "") delete next[key];
      else Object.assign(next, { [key]: value });
      return next;
    });
  const sortBy = (sort: Sort) =>
    setFilters((current) => ({
      ...current,
      sort,
      order: current.sort === sort && current.order === "asc" ? "desc" : "asc",
      page: 1,
    }));
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const toggleAll = (checked: boolean) =>
    setSelected(checked ? new Set(items.map((item) => item.id)) : new Set());
  const toggleOne = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  const saveInline = async (id: string, input: { categoryId?: string; neutral?: boolean }) => {
    setActionError("");
    try {
      await update.mutateAsync({ id, input });
    } catch (reason) {
      setActionError(
        input.categoryId
          ? "Não foi possível salvar a categoria"
          : messageForError(reason, "transaction"),
      );
    }
  };
  const applyBulk = async () => {
    if (!bulkCategory || selected.size === 0) return;
    setActionError("");
    try {
      await bulk.mutateAsync({ ids: [...selected], categoryId: bulkCategory });
      setSelected(new Set());
      setBulkCategory("");
    } catch (reason) {
      setActionError(messageForError(reason, "transaction"));
    }
  };
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 50));

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent-foreground">Movimentações</p>
          <h1 className="mt-1 text-3xl font-semibold">Extrato</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Transferências neutras não contam em receitas, despesas nem patrimônio.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus />
          Nova transação
        </Button>
      </header>
      <section
        aria-label="Filtros do extrato"
        className="grid gap-4 border-b py-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
      >
        <Filter label="De" id="filter-from">
          <Input
            id="filter-from"
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => changeFilter("from", e.target.value)}
          />
        </Filter>
        <Filter label="Até" id="filter-to">
          <Input
            id="filter-to"
            type="date"
            value={filters.to ?? ""}
            onChange={(e) => changeFilter("to", e.target.value)}
          />
        </Filter>
        <Filter label="Conta" id="filter-account">
          <AccountSelect
            id="filter-account"
            includeInactive
            value={filters.accountId}
            onChange={(value) => changeFilter("accountId", value)}
          />
        </Filter>
        <Filter label="Categoria" id="filter-category">
          <CategorySelect
            id="filter-category"
            value={filters.categoryId}
            onChange={(value) => changeFilter("categoryId", value)}
          />
        </Filter>
        <Filter label="Tipo" id="filter-type">
          <SimpleSelect
            id="filter-type"
            value={filters.type ?? "all"}
            onChange={(value) =>
              changeFilter("type", value === "all" ? undefined : (value as "Income" | "Expense"))
            }
            options={[
              ["all", "Todos"],
              ["Income", "Receita"],
              ["Expense", "Despesa"],
            ]}
          />
        </Filter>
        <Filter label="Neutra" id="filter-neutral">
          <SimpleSelect
            id="filter-neutral"
            value={filters.neutral === undefined ? "all" : String(filters.neutral)}
            onChange={(value) =>
              changeFilter("neutral", value === "all" ? undefined : value === "true")
            }
            options={[
              ["all", "Todas"],
              ["true", "Sim"],
              ["false", "Não"],
            ]}
          />
        </Filter>
        <div className="flex items-end">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setFilters(baseFilters);
              setSearch("");
            }}
          >
            Limpar filtros
          </Button>
        </div>
        <div className="relative sm:col-span-2 lg:col-span-4 xl:col-span-7">
          <Label htmlFor="transaction-search" className="sr-only">
            Buscar por nome
          </Label>
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            id="transaction-search"
            className="pl-9"
            placeholder="Buscar por nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {invalidPeriod && (
          <p
            role="alert"
            className="text-sm text-destructive sm:col-span-2 lg:col-span-4 xl:col-span-7"
          >
            A data inicial deve ser anterior à final
          </p>
        )}
      </section>
      {selected.size > 0 && (
        <div className="my-4 flex flex-col gap-3 border-y bg-muted/40 px-4 py-3 sm:flex-row sm:items-center">
          <strong className="text-sm">{selected.size} selecionada(s)</strong>
          <div className="min-w-56 flex-1">
            <CategorySelect value={bulkCategory} onChange={setBulkCategory} />
          </div>
          <Button onClick={applyBulk} disabled={!bulkCategory || bulk.isPending}>
            Aplicar categoria
          </Button>
        </div>
      )}
      {actionError && (
        <p role="alert" className="my-4 text-sm text-destructive">
          {actionError}
        </p>
      )}
      {isLoading && <p className="py-10 text-sm text-muted-foreground">Carregando transações…</p>}
      {isError && (
        <div className="flex items-center gap-3 py-10">
          <p className="text-sm text-destructive">Não foi possível carregar o extrato.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <p className="border-y py-12 text-center text-sm text-muted-foreground">
          Nenhuma transação encontrada
        </p>
      )}
      {items.length > 0 && (
        <>
          <div className="hidden overflow-x-auto border-b md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Selecionar todas da página"
                      checked={allSelected}
                      onCheckedChange={(value) => toggleAll(value === true)}
                    />
                  </TableHead>
                  <Sortable label="Data" name="date" filters={filters} onSort={sortBy} />
                  <Sortable label="Nome" name="name" filters={filters} onSort={sortBy} />
                  <TableHead>Conta</TableHead>
                  <Sortable label="Categoria" name="category" filters={filters} onSort={sortBy} />
                  <TableHead>Método de pagamento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <Sortable label="Valor" name="amount" filters={filters} onSort={sortBy} />
                  <TableHead>Neutra</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TransactionRow
                    key={item.id}
                    item={item}
                    selected={selected.has(item.id)}
                    onSelected={(value) => toggleOne(item.id, value)}
                    onCategory={(categoryId) => saveInline(item.id, { categoryId })}
                    onNeutral={(neutral) => saveInline(item.id, { neutral })}
                    onEdit={() => {
                      setEditing(item);
                      setFormOpen(true);
                    }}
                    onDelete={() => setDeleting(item)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y border-y md:hidden">
            {items.map((item) => (
              <TransactionCard
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                onSelected={(value) => toggleOne(item.id, value)}
                onCategory={(categoryId) => saveInline(item.id, { categoryId })}
                onNeutral={(neutral) => saveInline(item.id, { neutral })}
                onEdit={() => {
                  setEditing(item);
                  setFormOpen(true);
                }}
                onDelete={() => setDeleting(item)}
              />
            ))}
          </div>
        </>
      )}
      {data && data.total > 0 && (
        <footer className="flex flex-col gap-3 py-5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            {data.total} transações · Página {data.page} de {pages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: Math.max(1, (current.page ?? 1) - 1),
                }))
              }
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= pages}
              onClick={() =>
                setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }))
              }
            >
              Próxima
            </Button>
          </div>
        </footer>
      )}
      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        {...(editing ? { transaction: editing } : {})}
      />
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta transação?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                try {
                  await remove.mutateAsync(deleting.id);
                  setDeleting(undefined);
                } catch (reason) {
                  setActionError(messageForError(reason, "transaction"));
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Filter({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
function SimpleSelect({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Sortable({
  label,
  name,
  filters,
  onSort,
}: {
  label: string;
  name: Sort;
  filters: TransactionFilters;
  onSort: (sort: Sort) => void;
}) {
  const Icon = filters.sort !== name ? ArrowUpDown : filters.order === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead>
      <Button variant="ghost" size="sm" className="-ml-3" onClick={() => onSort(name)}>
        {label}
        <Icon className="size-3.5" />
      </Button>
    </TableHead>
  );
}

type RowProps = {
  item: Transaction;
  selected: boolean;
  onSelected: (value: boolean) => void;
  onCategory: (id: string) => void;
  onNeutral: (value: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
};
function TransactionRow({
  item,
  selected,
  onSelected,
  onCategory,
  onNeutral,
  onEdit,
  onDelete,
}: RowProps) {
  return (
    <TableRow className={item.neutral ? "opacity-55" : ""}>
      <TableCell>
        <Checkbox
          aria-label={`Selecionar ${item.name}`}
          checked={selected}
          onCheckedChange={(value) => onSelected(value === true)}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap">{formatDateLocal(item.occurredAt)}</TableCell>
      <TableCell className="min-w-40 font-medium">{item.name}</TableCell>
      <TableCell>{item.accountNickname}</TableCell>
      <TableCell className="min-w-48">
        <CategorySelect value={item.categoryId} onChange={onCategory} />
      </TableCell>
      <TableCell>{paymentMethodLabels[item.paymentMethod]}</TableCell>
      <TableCell>{transactionTypeLabels[item.type]}</TableCell>
      <TableCell
        className={`whitespace-nowrap font-semibold ${item.type === "Expense" ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"}`}
      >
        {item.type === "Expense" ? `-${formatBRL(item.amount)}` : formatBRL(item.amount)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            aria-label={`Marcar ${item.name} como neutra`}
            checked={item.neutral}
            onCheckedChange={onNeutral}
          />
          {item.neutral && <Badge variant="secondary">Neutra</Badge>}
        </div>
      </TableCell>
      <TableCell className="max-w-48 truncate">{item.notes ?? "—"}</TableCell>
      <TableCell>
        <div className="flex">
          <Button variant="ghost" size="icon" aria-label={`Editar ${item.name}`} onClick={onEdit}>
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Excluir ${item.name}`}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
function TransactionCard(props: RowProps) {
  const { item } = props;
  return (
    <article className={`space-y-4 py-5 ${item.neutral ? "opacity-55" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Checkbox
            aria-label={`Selecionar ${item.name}`}
            checked={props.selected}
            onCheckedChange={(value) => props.onSelected(value === true)}
          />
          <div>
            <h2 className="font-semibold">{item.name}</h2>
            <p className="text-sm text-muted-foreground">
              {formatDateLocal(item.occurredAt)} · {item.accountNickname}
            </p>
          </div>
        </div>
        <span
          className={`font-semibold ${item.type === "Expense" ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"}`}
        >
          {item.type === "Expense" ? `-${formatBRL(item.amount)}` : formatBRL(item.amount)}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Método</dt>
          <dd>{paymentMethodLabels[item.paymentMethod]}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Tipo</dt>
          <dd>{transactionTypeLabels[item.type]}</dd>
        </div>
      </dl>
      <CategorySelect value={item.categoryId} onChange={props.onCategory} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            aria-label={`Marcar ${item.name} como neutra`}
            checked={item.neutral}
            onCheckedChange={props.onNeutral}
          />
          <span className="text-sm">Neutra</span>
        </div>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Editar ${item.name}`}
            onClick={props.onEdit}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Excluir ${item.name}`}
            onClick={props.onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
    </article>
  );
}

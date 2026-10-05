-- Transactions (transactions feature).
-- `unaccent` lives in the `extensions` schema (Supabase convention); callers qualify it as
-- extensions.unaccent(...) because SET ROLE does not apply the role's search_path.

create extension if not exists unaccent with schema extensions;
grant usage on schema extensions to authenticated;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  category_id uuid not null,
  name text not null check (length(btrim(name)) > 0),
  type text not null check (type in ('Income', 'Expense')),
  occurred_at timestamptz not null,
  amount numeric(14, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in
    ('BankTransfer', 'Boleto', 'Cash', 'CreditCard', 'DebitCard', 'NuPay', 'PIX')),
  notes text,
  receipt text,
  identifier text,
  counterparty_document text,
  counterparty_bank text,
  neutral boolean not null default false,
  import_batch_id uuid, -- the foreign key is added by the import migration
  created_at timestamptz not null default now(),
  -- `no action` (not `restrict`) so deleting a user cascades without depending on constraint order.
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete no action,
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete no action
);

create index transactions_user_date_idx on public.transactions (user_id, occurred_at desc);
create index transactions_account_identifier_idx on public.transactions (account_id, identifier)
  where identifier is not null;
create index transactions_user_category_idx on public.transactions (user_id, category_id);

alter table public.transactions enable row level security;

create policy transactions_all on public.transactions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke truncate on public.transactions from anon, authenticated;

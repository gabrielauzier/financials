-- Credit expenses (credit-expenses feature): manual, independent tracking of card installments and
-- recurring charges. No link to transactions. The remaining amount is not stored: the API computes
-- `total_amount - paid_amount` on every read.

create table public.credit_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  category_id uuid not null,
  name text not null check (length(btrim(name)) > 0),
  total_amount numeric(14, 2) not null check (total_amount > 0),
  paid_amount numeric(14, 2) not null default 0,
  occurred_at timestamptz not null,
  recurrency_day smallint not null check (recurrency_day between 1 and 31),
  status text not null check (status in ('Once', 'Active', 'Inactive', 'Canceled', 'ToCancel')),
  notes text,
  created_at timestamptz not null default now(),
  constraint credit_expenses_paid_range_check check (paid_amount >= 0 and paid_amount <= total_amount),
  -- `no action` (not `restrict`) so deleting a user cascades without depending on constraint order.
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete no action,
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete no action
);

create index credit_expenses_user_status_idx on public.credit_expenses (user_id, status);
create index credit_expenses_user_category_idx on public.credit_expenses (user_id, category_id);

alter table public.credit_expenses enable row level security;

create policy credit_expenses_all on public.credit_expenses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke truncate on public.credit_expenses from anon, authenticated;

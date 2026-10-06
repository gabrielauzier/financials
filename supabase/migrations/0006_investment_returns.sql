-- Investment returns (dashboards feature): manual gain or loss entries that move only the net worth.
-- Contributions are ordinary transactions in the Investments category and never touch this table.

create table public.investment_returns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  occurred_on date not null,
  amount numeric(14, 2) not null check (amount <> 0),
  notes text,
  created_at timestamptz not null default now(),
  -- `no action` (not `restrict`) so deleting a user cascades without depending on constraint order.
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete no action
);

create index investment_returns_user_date_idx on public.investment_returns (user_id, occurred_on desc);

alter table public.investment_returns enable row level security;

create policy investment_returns_all on public.investment_returns
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke truncate on public.investment_returns from anon, authenticated;

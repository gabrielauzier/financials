-- Accounts and categories (accounts-categories feature).
-- Also redefines handle_new_user (from 0001) so new users get the 17 default categories.

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  bank text not null check (bank in ('Nubank', 'SofisaDireto', 'Neon', 'XP', 'Other')),
  nickname text not null check (length(btrim(nickname)) > 0),
  holder_names text[] not null check (cardinality(holder_names) >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index accounts_nickname_uq on public.accounts (user_id, lower(btrim(nickname)));

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text, -- stable identifier of the seeded categories
  name text not null check (length(btrim(name)) > 0), -- displayed text (pt-BR)
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index categories_name_uq on public.categories (user_id, lower(btrim(name)));
create unique index categories_key_uq on public.categories (user_id, key) where key is not null;

alter table public.accounts enable row level security;
alter table public.categories enable row level security;

create policy accounts_all on public.accounts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- System categories cannot be created, changed or removed by users.
create policy categories_select on public.categories
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy categories_insert on public.categories
  for insert to authenticated
  with check (user_id = (select auth.uid()) and not is_system);

create policy categories_update on public.categories
  for update to authenticated
  using (user_id = (select auth.uid()) and not is_system)
  with check (user_id = (select auth.uid()) and not is_system);

create policy categories_delete on public.categories
  for delete to authenticated
  using (user_id = (select auth.uid()) and not is_system);

-- Accounts are never deleted (the `for all` policy would otherwise allow it).
revoke delete on public.accounts from authenticated;
revoke truncate on public.accounts, public.categories from anon, authenticated;

-- Idempotent: a second run for the same user inserts nothing.
create function public.seed_categories(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.categories (user_id, key, name, is_system) values
    (p_user, 'Entertainment', 'Entretenimento', false),
    (p_user, 'Food', 'Alimentação', false),
    (p_user, 'Salaries', 'Salários', false),
    (p_user, 'Healthcare', 'Saúde', false),
    (p_user, 'Utilities', 'Utilidades', false),
    (p_user, 'Unknown', 'Desconhecida', false),
    (p_user, 'Transport', 'Transporte', false),
    (p_user, 'Help', 'Ajuda (a terceiros)', false),
    (p_user, 'PJ', 'PJ', false),
    (p_user, 'Bills', 'Contas', false),
    (p_user, 'Emergency', 'Emergência', false),
    (p_user, 'Uncategorized', 'Sem categoria', true),
    (p_user, 'Wishes', 'Desejos', false),
    (p_user, 'Reversal', 'Estorno (de compras)', true),
    (p_user, 'Shopping', 'Compras', false),
    (p_user, 'Pets', 'Pets', false),
    (p_user, 'Investments', 'Investimentos', true)
  on conflict do nothing;
$$;

revoke execute on function public.seed_categories(uuid) from public, anon, authenticated;

-- Same as 0001 plus the category seed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'nickname', '')
  );
  perform public.seed_categories(new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

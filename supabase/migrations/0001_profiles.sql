-- Profiles: one row per auth user with name and nickname from the sign-up metadata.
-- The category seed is added later by accounts-categories (it redefines handle_new_user).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  nickname text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Runs as the owner so the trigger can insert past RLS. No dynamic SQL; search_path pinned.
create function public.handle_new_user()
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
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

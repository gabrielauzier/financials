-- Imports (import feature): import batches, their attachments, the transactions -> batch link
-- and the private `imports` Storage bucket (objects live under `{user_id}/...`).

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  bank text not null,
  idempotency_key uuid not null,
  row_count int not null,
  imported_count int not null,
  skipped_count int not null,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  -- A repeated confirmation of the same preview finds the existing batch (IMP-05.11).
  unique (user_id, idempotency_key),
  -- `no action` (not `restrict`) so deleting a user cascades without depending on constraint order.
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete no action
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  import_batch_id uuid not null,
  filename text not null,
  mime_type text not null,
  size_bytes int not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  foreign key (import_batch_id, user_id) references public.import_batches (id, user_id) on delete cascade
);

create index attachments_import_batch_idx on public.attachments (import_batch_id);

alter table public.transactions
  add constraint transactions_import_batch_fkey
  foreign key (import_batch_id, user_id) references public.import_batches (id, user_id) on delete no action;

create index transactions_import_batch_idx on public.transactions (import_batch_id)
  where import_batch_id is not null;

alter table public.import_batches enable row level security;
alter table public.attachments enable row level security;

create policy import_batches_all on public.import_batches
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy attachments_all on public.attachments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke truncate on public.import_batches, public.attachments from anon, authenticated;

-- Storage: private bucket; a signed-in user reaches only objects whose first folder is their id.
-- No policy targets `anon`, so anonymous requests see and write nothing.
insert into storage.buckets (id, name, public) values ('imports', 'imports', false);

create policy imports_own_folder on storage.objects
  for all to authenticated
  using (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text);

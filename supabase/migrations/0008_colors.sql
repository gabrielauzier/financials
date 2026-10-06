-- Colors (colors-and-icons feature): palette domain, color columns, backfill and colored seed.
-- Colors are palette keys (22 Tailwind families x shades 400, 600, 900), never free hex values.
-- Additive: RLS policies are untouched; the existing rows are filled by the column default.

create domain public.palette_color as text
  check (value in (
  'red-400','red-600','red-900','orange-400','orange-600','orange-900',
  'amber-400','amber-600','amber-900','yellow-400','yellow-600','yellow-900',
  'lime-400','lime-600','lime-900','green-400','green-600','green-900',
  'emerald-400','emerald-600','emerald-900','teal-400','teal-600','teal-900',
  'cyan-400','cyan-600','cyan-900','sky-400','sky-600','sky-900',
  'blue-400','blue-600','blue-900','indigo-400','indigo-600','indigo-900',
  'violet-400','violet-600','violet-900','purple-400','purple-600','purple-900',
  'fuchsia-400','fuchsia-600','fuchsia-900','pink-400','pink-600','pink-900',
  'rose-400','rose-600','rose-900','slate-400','slate-600','slate-900',
  'gray-400','gray-600','gray-900','zinc-400','zinc-600','zinc-900',
  'neutral-400','neutral-600','neutral-900','stone-400','stone-600','stone-900'
  ));

alter table public.categories add column color public.palette_color not null default 'slate-600';
alter table public.accounts add column color public.palette_color not null default 'slate-600';

-- backfill:begin
update public.categories set color = case key
    when 'Entertainment' then 'purple-600'
    when 'Food' then 'orange-600'
    when 'Salaries' then 'emerald-600'
    when 'Healthcare' then 'rose-600'
    when 'Utilities' then 'sky-600'
    when 'Unknown' then 'zinc-400'
    when 'Transport' then 'blue-600'
    when 'Help' then 'pink-600'
    when 'PJ' then 'indigo-600'
    when 'Bills' then 'amber-600'
    when 'Emergency' then 'red-600'
    when 'Uncategorized' then 'slate-400'
    when 'Wishes' then 'fuchsia-600'
    when 'Reversal' then 'teal-600'
    when 'Shopping' then 'lime-600'
    when 'Pets' then 'yellow-600'
    when 'Investments' then 'green-900'
  end
  where key in ('Entertainment', 'Food', 'Salaries', 'Healthcare', 'Utilities', 'Unknown', 'Transport', 'Help', 'PJ', 'Bills', 'Emergency', 'Uncategorized', 'Wishes', 'Reversal', 'Shopping', 'Pets', 'Investments');

update public.accounts set color = case bank
    when 'Nubank' then 'purple-600'
    when 'SofisaDireto' then 'teal-600'
    when 'Neon' then 'sky-600'
    when 'XP' then 'zinc-900'
    else 'slate-600'
  end;
-- backfill:end

-- Same 17 rows as 0002 plus the color. handle_new_user (0002) keeps calling this function.
create or replace function public.seed_categories(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.categories (user_id, key, name, is_system, color) values
    (p_user, 'Entertainment', 'Entretenimento', false, 'purple-600'),
    (p_user, 'Food', 'Alimentação', false, 'orange-600'),
    (p_user, 'Salaries', 'Salários', false, 'emerald-600'),
    (p_user, 'Healthcare', 'Saúde', false, 'rose-600'),
    (p_user, 'Utilities', 'Utilidades', false, 'sky-600'),
    (p_user, 'Unknown', 'Desconhecida', false, 'zinc-400'),
    (p_user, 'Transport', 'Transporte', false, 'blue-600'),
    (p_user, 'Help', 'Ajuda (a terceiros)', false, 'pink-600'),
    (p_user, 'PJ', 'PJ', false, 'indigo-600'),
    (p_user, 'Bills', 'Contas', false, 'amber-600'),
    (p_user, 'Emergency', 'Emergência', false, 'red-600'),
    (p_user, 'Uncategorized', 'Sem categoria', true, 'slate-400'),
    (p_user, 'Wishes', 'Desejos', false, 'fuchsia-600'),
    (p_user, 'Reversal', 'Estorno (de compras)', true, 'teal-600'),
    (p_user, 'Shopping', 'Compras', false, 'lime-600'),
    (p_user, 'Pets', 'Pets', false, 'yellow-600'),
    (p_user, 'Investments', 'Investimentos', true, 'green-900')
  on conflict do nothing;
$$;

revoke execute on function public.seed_categories(uuid) from public, anon, authenticated;

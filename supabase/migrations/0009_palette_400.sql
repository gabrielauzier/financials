-- Palette 400 (colors-and-icons follow-up): one shade per family, 22 keys `<family>-400`.
-- 0008 stays as applied. This file remaps the stored values (`-600` and `-900` become `-400`),
-- replaces the domain check, moves the column defaults to slate-400 and reseeds the 17 categories
-- with 17 distinct colors among the 22. Additive: RLS policies are untouched.

alter domain public.palette_color drop constraint palette_color_check;

-- remap:begin
update public.categories set color = regexp_replace(color, '-(600|900)$', '-400')
  where color ~ '-(600|900)$';
update public.accounts set color = regexp_replace(color, '-(600|900)$', '-400')
  where color ~ '-(600|900)$';
-- remap:end

alter domain public.palette_color add constraint palette_color_check
  check (value in (
  'red-400','orange-400','amber-400','yellow-400','lime-400','green-400',
  'emerald-400','teal-400','cyan-400','sky-400','blue-400','indigo-400',
  'violet-400','purple-400','fuchsia-400','pink-400','rose-400','slate-400',
  'gray-400','zinc-400','neutral-400','stone-400'
  )) not valid;
alter domain public.palette_color validate constraint palette_color_check;

alter table public.categories alter column color set default 'slate-400';
alter table public.accounts alter column color set default 'slate-400';

-- Bank defaults of the existing accounts stay what the remap gave them (Nubank purple-400,
-- Sofisa Direto teal-400, Neon sky-400, XP zinc-400, other slate-400).

-- Same 17 rows as 0008, all in shade 400. handle_new_user (0002) keeps calling this function.
create or replace function public.seed_categories(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.categories (user_id, key, name, is_system, color) values
    (p_user, 'Entertainment', 'Entretenimento', false, 'purple-400'),
    (p_user, 'Food', 'Alimentação', false, 'orange-400'),
    (p_user, 'Salaries', 'Salários', false, 'emerald-400'),
    (p_user, 'Healthcare', 'Saúde', false, 'rose-400'),
    (p_user, 'Utilities', 'Utilidades', false, 'sky-400'),
    (p_user, 'Unknown', 'Desconhecida', false, 'zinc-400'),
    (p_user, 'Transport', 'Transporte', false, 'blue-400'),
    (p_user, 'Help', 'Ajuda (a terceiros)', false, 'pink-400'),
    (p_user, 'PJ', 'PJ', false, 'indigo-400'),
    (p_user, 'Bills', 'Contas', false, 'amber-400'),
    (p_user, 'Emergency', 'Emergência', false, 'red-400'),
    (p_user, 'Uncategorized', 'Sem categoria', true, 'slate-400'),
    (p_user, 'Wishes', 'Desejos', false, 'fuchsia-400'),
    (p_user, 'Reversal', 'Estorno (de compras)', true, 'teal-400'),
    (p_user, 'Shopping', 'Compras', false, 'lime-400'),
    (p_user, 'Pets', 'Pets', false, 'yellow-400'),
    (p_user, 'Investments', 'Investimentos', true, 'green-400')
  on conflict do nothing;
$$;

revoke execute on function public.seed_categories(uuid) from public, anon, authenticated;

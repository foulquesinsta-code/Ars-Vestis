-- À exécuter sur le projet Supabase cible, jamais avec une clé privilégiée dans le navigateur.
create table public.app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

-- Aucun accès anonyme ; les utilisateurs authentifiés ne reçoivent que les
-- permissions nécessaires aux quatre opérations couvertes par les politiques.
revoke all on table public.app_data from public, anon, authenticated;
grant select, insert, update, delete on table public.app_data to authenticated;

create policy app_data_select_own on public.app_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy app_data_insert_own on public.app_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy app_data_update_own on public.app_data
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy app_data_delete_own on public.app_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- L'horodatage est décidé par la base, pas par l'horloge du navigateur.
create function public.set_app_data_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_app_data_updated_at() from public, anon, authenticated;

create trigger app_data_updated_at
  before insert or update on public.app_data
  for each row execute function public.set_app_data_updated_at();

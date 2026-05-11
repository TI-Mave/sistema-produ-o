-- =====================================================================
-- Sistema de aprovacao de usuarios por admin
-- Rode este arquivo no SQL Editor do Supabase. Idempotente.
-- =====================================================================

-- ---------- Tabela de perfis ----------
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user','admin')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists user_profiles_status_idx on public.user_profiles(status);
create index if not exists user_profiles_role_idx on public.user_profiles(role);

-- ---------- Funcoes auxiliares (security definer pra evitar loop em RLS) ----------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

create or replace function public.is_approved()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.user_profiles
    where id = auth.uid() and status = 'approved'
  );
$$;

-- ---------- Trigger pra criar perfil quando usuario novo eh cadastrado ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_first boolean;
begin
  -- Primeiro usuario do sistema vira admin automaticamente
  select not exists (select 1 from public.user_profiles) into v_is_first;

  insert into public.user_profiles (id, email, role, status, approved_at, approved_by)
  values (
    new.id,
    new.email,
    case when v_is_first then 'admin' else 'user' end,
    case when v_is_first then 'approved' else 'pending' end,
    case when v_is_first then now() else null end,
    case when v_is_first then new.id else null end
  );
  return new;
end;
$$;

drop trigger if exists handle_new_user_trigger on auth.users;
create trigger handle_new_user_trigger
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Backfill: cria profiles para usuarios que ja existiam ----------
-- Mantem todos como approved (nao quebra quem ja estava usando).
-- O mais antigo vira admin.
insert into public.user_profiles (id, email, role, status, approved_at, approved_by)
select
  u.id,
  u.email,
  case when u.id = (select id from auth.users order by created_at asc limit 1) then 'admin' else 'user' end,
  'approved',
  now(),
  u.id
from auth.users u
where not exists (select 1 from public.user_profiles p where p.id = u.id);

-- =====================================================================
-- RLS de user_profiles
-- =====================================================================
alter table public.user_profiles enable row level security;

drop policy if exists "users see own profile"   on public.user_profiles;
drop policy if exists "admins see all profiles" on public.user_profiles;
drop policy if exists "admins update profiles"  on public.user_profiles;

create policy "users see own profile" on public.user_profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "admins update profiles" on public.user_profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- Substitui RLS das tabelas existentes: exige status=approved
-- =====================================================================

-- Cores
drop policy if exists "auth read cores"   on public.cores;
drop policy if exists "auth write cores"  on public.cores;
drop policy if exists "auth update cores" on public.cores;
drop policy if exists "auth delete cores" on public.cores;
create policy "approved read cores"   on public.cores for select to authenticated using (public.is_approved());
create policy "approved write cores"  on public.cores for insert to authenticated with check (public.is_approved());
create policy "approved update cores" on public.cores for update to authenticated using (public.is_approved()) with check (public.is_approved());
create policy "approved delete cores" on public.cores for delete to authenticated using (public.is_approved());

-- Config items
drop policy if exists "auth read config"   on public.config_items;
drop policy if exists "auth write config"  on public.config_items;
drop policy if exists "auth update config" on public.config_items;
drop policy if exists "auth delete config" on public.config_items;
create policy "approved read config"   on public.config_items for select to authenticated using (public.is_approved());
create policy "approved write config"  on public.config_items for insert to authenticated with check (public.is_approved());
create policy "approved update config" on public.config_items for update to authenticated using (public.is_approved()) with check (public.is_approved());
create policy "approved delete config" on public.config_items for delete to authenticated using (public.is_approved());

-- Registros trancadeira
drop policy if exists "auth read trancadeira"   on public.registros_trancadeira;
drop policy if exists "auth write trancadeira"  on public.registros_trancadeira;
drop policy if exists "auth update trancadeira" on public.registros_trancadeira;
drop policy if exists "auth delete trancadeira" on public.registros_trancadeira;
create policy "approved read trancadeira"   on public.registros_trancadeira for select to authenticated using (public.is_approved());
create policy "approved write trancadeira"  on public.registros_trancadeira for insert to authenticated with check (public.is_approved());
create policy "approved update trancadeira" on public.registros_trancadeira for update to authenticated using (public.is_approved()) with check (public.is_approved());
create policy "approved delete trancadeira" on public.registros_trancadeira for delete to authenticated using (public.is_approved());

-- Registros grampeadeira
drop policy if exists "auth read grampeadeira"   on public.registros_grampeadeira;
drop policy if exists "auth write grampeadeira"  on public.registros_grampeadeira;
drop policy if exists "auth update grampeadeira" on public.registros_grampeadeira;
drop policy if exists "auth delete grampeadeira" on public.registros_grampeadeira;
create policy "approved read grampeadeira"   on public.registros_grampeadeira for select to authenticated using (public.is_approved());
create policy "approved write grampeadeira"  on public.registros_grampeadeira for insert to authenticated with check (public.is_approved());
create policy "approved update grampeadeira" on public.registros_grampeadeira for update to authenticated using (public.is_approved()) with check (public.is_approved());
create policy "approved delete grampeadeira" on public.registros_grampeadeira for delete to authenticated using (public.is_approved());

-- Registros extensor
drop policy if exists "auth read extensor"   on public.registros_extensor;
drop policy if exists "auth write extensor"  on public.registros_extensor;
drop policy if exists "auth update extensor" on public.registros_extensor;
drop policy if exists "auth delete extensor" on public.registros_extensor;
create policy "approved read extensor"   on public.registros_extensor for select to authenticated using (public.is_approved());
create policy "approved write extensor"  on public.registros_extensor for insert to authenticated with check (public.is_approved());
create policy "approved update extensor" on public.registros_extensor for update to authenticated using (public.is_approved()) with check (public.is_approved());
create policy "approved delete extensor" on public.registros_extensor for delete to authenticated using (public.is_approved());

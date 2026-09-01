-- =====================================================================
-- Mave Producao - Novas estacoes: Mangueiras, Cordas e Retorno
-- Industrializado + tipo 'pacote' em config_items.
-- Rode este arquivo inteiro no SQL Editor do projeto Supabase.
-- =====================================================================

-- 'pacote' passa a ser um tipo valido de item de configuracao
-- (usado pelo Retorno Industrializado: PCT 10, PCT 50, etc.)
alter table public.config_items drop constraint if exists config_items_tipo_check;
alter table public.config_items add constraint config_items_tipo_check
  check (tipo in ('diametro','caixa','tamanho','gancho','pacote'));

-- ---------- Registros: Mangueiras ----------
create table if not exists public.registros_mangueira (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  hora text not null,
  data date not null,
  nome text not null,
  qtd integer not null,
  created_at timestamptz not null default now()
);
create index if not exists registros_mangueira_data_idx on public.registros_mangueira(data);

-- ---------- Registros: Cordas ----------
create table if not exists public.registros_corda (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  hora text not null,
  data date not null,
  nome text not null,
  qtd integer not null,
  created_at timestamptz not null default now()
);
create index if not exists registros_corda_data_idx on public.registros_corda(data);

-- ---------- Registros: Retorno Industrializado ----------
-- pacotes: jsonb { "PCT 10": 3, "PCT 50": 2 } — quantidade por tipo de pacote
-- total: unidades totais (multiplicador extraido do nome do pacote x qtd)
create table if not exists public.registros_retorno (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  hora text not null,
  data date not null,
  tamanho text not null,
  pacotes jsonb not null default '{}'::jsonb,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists registros_retorno_data_idx on public.registros_retorno(data);

-- =====================================================================
-- RLS: mesmo modelo das demais tabelas de registro
-- =====================================================================
alter table public.registros_mangueira enable row level security;
alter table public.registros_corda     enable row level security;
alter table public.registros_retorno   enable row level security;

-- Registros mangueira
drop policy if exists "auth read mangueira"   on public.registros_mangueira;
drop policy if exists "auth write mangueira"  on public.registros_mangueira;
drop policy if exists "auth update mangueira" on public.registros_mangueira;
drop policy if exists "auth delete mangueira" on public.registros_mangueira;
create policy "auth read mangueira"   on public.registros_mangueira for select to authenticated using (true);
create policy "auth write mangueira"  on public.registros_mangueira for insert to authenticated with check (true);
create policy "auth update mangueira" on public.registros_mangueira for update to authenticated using (true) with check (true);
create policy "auth delete mangueira" on public.registros_mangueira for delete to authenticated using (true);

-- Registros corda
drop policy if exists "auth read corda"   on public.registros_corda;
drop policy if exists "auth write corda"  on public.registros_corda;
drop policy if exists "auth update corda" on public.registros_corda;
drop policy if exists "auth delete corda" on public.registros_corda;
create policy "auth read corda"   on public.registros_corda for select to authenticated using (true);
create policy "auth write corda"  on public.registros_corda for insert to authenticated with check (true);
create policy "auth update corda" on public.registros_corda for update to authenticated using (true) with check (true);
create policy "auth delete corda" on public.registros_corda for delete to authenticated using (true);

-- Registros retorno
drop policy if exists "auth read retorno"   on public.registros_retorno;
drop policy if exists "auth write retorno"  on public.registros_retorno;
drop policy if exists "auth update retorno" on public.registros_retorno;
drop policy if exists "auth delete retorno" on public.registros_retorno;
create policy "auth read retorno"   on public.registros_retorno for select to authenticated using (true);
create policy "auth write retorno"  on public.registros_retorno for insert to authenticated with check (true);
create policy "auth update retorno" on public.registros_retorno for update to authenticated using (true) with check (true);
create policy "auth delete retorno" on public.registros_retorno for delete to authenticated using (true);

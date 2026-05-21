-- =====================================================================
-- Mave Producao - Tabela Operadores (estruturada)
-- Substitui o uso de config_items.tipo = 'operador' por uma tabela
-- propria com Nome, Nro Matricula, Funcao, Turno e Capacidade Produtiva.
-- Rode este arquivo inteiro no SQL Editor do projeto Supabase.
-- =====================================================================

create table if not exists public.operadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  matricula text,
  funcao text,
  turno text,
  capacidade_produtiva numeric(10,2),
  created_at timestamptz not null default now()
);
create index if not exists operadores_nome_idx on public.operadores (nome);

alter table public.operadores enable row level security;

drop policy if exists "auth read operadores"   on public.operadores;
drop policy if exists "auth write operadores"  on public.operadores;
drop policy if exists "auth update operadores" on public.operadores;
drop policy if exists "auth delete operadores" on public.operadores;
create policy "auth read operadores"   on public.operadores for select to authenticated using (true);
create policy "auth write operadores"  on public.operadores for insert to authenticated with check (true);
create policy "auth update operadores" on public.operadores for update to authenticated using (true) with check (true);
create policy "auth delete operadores" on public.operadores for delete to authenticated using (true);

-- ---------- Migracao dos dados antigos (config_items tipo='operador') ----------
-- Extrai "Nome (matricula)" -> nome + matricula. Idempotente: so migra
-- se a tabela operadores ainda nao tiver registros.
insert into public.operadores (nome, matricula)
select
  trim(regexp_replace(valor, '\s*\(.*\)\s*$', '')) as nome,
  nullif(trim(both ' ()' from substring(valor from '\(([^)]+)\)')), '') as matricula
from public.config_items
where tipo = 'operador'
  and not exists (select 1 from public.operadores);

-- Remove os registros antigos da tabela generica (so depois de migrar)
delete from public.config_items
where tipo = 'operador'
  and exists (select 1 from public.operadores);

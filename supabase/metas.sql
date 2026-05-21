-- =====================================================================
-- Mave Producao - Tabela Metas (estruturada)
-- Substitui o uso de config_items.tipo = 'meta' por uma tabela
-- propria com Tipo Meta (Geral / Operador) e Meta (valor diario).
-- Rode este arquivo inteiro no SQL Editor do projeto Supabase.
-- =====================================================================

create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('geral','operador')),
  operador text,
  valor numeric(10,2) not null,
  created_at timestamptz not null default now()
);
create index if not exists metas_tipo_idx on public.metas (tipo);

alter table public.metas enable row level security;

drop policy if exists "auth read metas"   on public.metas;
drop policy if exists "auth write metas"  on public.metas;
drop policy if exists "auth update metas" on public.metas;
drop policy if exists "auth delete metas" on public.metas;
create policy "auth read metas"   on public.metas for select to authenticated using (true);
create policy "auth write metas"  on public.metas for insert to authenticated with check (true);
create policy "auth update metas" on public.metas for update to authenticated using (true) with check (true);
create policy "auth delete metas" on public.metas for delete to authenticated using (true);

-- ---------- Migracao dos dados antigos (config_items tipo='meta') ----------
-- Formato esperado: "Nome · 1000/dia". Se Nome bate com "Meta Geral",
-- vira tipo='geral'; senao, tipo='operador' com operador=Nome.
-- Idempotente: so migra se a tabela metas estiver vazia.
insert into public.metas (tipo, operador, valor)
select
  case when trim(coalesce(substring(valor from '^(.+?)\s*[·\-]'), valor)) ~* '^meta\s*geral'
       then 'geral'
       else 'operador'
  end as tipo,
  case when trim(coalesce(substring(valor from '^(.+?)\s*[·\-]'), valor)) ~* '^meta\s*geral'
       then null
       else trim(coalesce(substring(valor from '^(.+?)\s*[·\-]'), valor))
  end as operador,
  coalesce(nullif(substring(valor from '(\d+)\s*/\s*dia'), '')::numeric, 0) as valor
from public.config_items
where tipo = 'meta'
  and not exists (select 1 from public.metas);

-- Remove os registros antigos da tabela generica (so depois de migrar)
delete from public.config_items
where tipo = 'meta'
  and exists (select 1 from public.metas);

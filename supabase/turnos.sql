-- =====================================================================
-- Mave Producao - Tabela Turnos (estruturada)
-- Substitui o uso de config_items.tipo = 'turno' por uma tabela
-- propria com Turno, Hora Inicio e Hora Fim.
-- Rode este arquivo inteiro no SQL Editor do projeto Supabase.
-- =====================================================================

create table if not exists public.turnos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  hora_inicio text,
  hora_fim text,
  created_at timestamptz not null default now()
);
create index if not exists turnos_nome_idx on public.turnos (nome);

alter table public.turnos enable row level security;

drop policy if exists "auth read turnos"   on public.turnos;
drop policy if exists "auth write turnos"  on public.turnos;
drop policy if exists "auth update turnos" on public.turnos;
drop policy if exists "auth delete turnos" on public.turnos;
create policy "auth read turnos"   on public.turnos for select to authenticated using (true);
create policy "auth write turnos"  on public.turnos for insert to authenticated with check (true);
create policy "auth update turnos" on public.turnos for update to authenticated using (true) with check (true);
create policy "auth delete turnos" on public.turnos for delete to authenticated using (true);

-- ---------- Migracao dos dados antigos (config_items tipo='turno') ----------
-- Formato esperado: "Turno A · 06:00 às 14:00" (ou variantes proximas).
-- Idempotente: so migra se a tabela turnos ainda estiver vazia.
insert into public.turnos (nome, hora_inicio, hora_fim)
select
  trim(coalesce(substring(valor from '^(.*?)\s·'), valor)) as nome,
  substring(valor from '(\d{2}:\d{2})\s+(?:às|as)\s+\d{2}:\d{2}') as hora_inicio,
  substring(valor from '\d{2}:\d{2}\s+(?:às|as)\s+(\d{2}:\d{2})') as hora_fim
from public.config_items
where tipo = 'turno'
  and not exists (select 1 from public.turnos);

-- Remove os registros antigos da tabela generica (so depois de migrar)
delete from public.config_items
where tipo = 'turno'
  and exists (select 1 from public.turnos);

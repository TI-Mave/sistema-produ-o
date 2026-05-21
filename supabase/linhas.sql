-- =====================================================================
-- Mave Producao - Tabela Linhas (estruturada)
-- Substitui o uso de config_items.tipo = 'linha' por uma tabela
-- propria com Linha e Capacidade Produtiva.
-- Rode este arquivo inteiro no SQL Editor do projeto Supabase.
-- =====================================================================

create table if not exists public.linhas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  capacidade_produtiva numeric(10,2),
  created_at timestamptz not null default now()
);
create index if not exists linhas_nome_idx on public.linhas (nome);

alter table public.linhas enable row level security;

drop policy if exists "auth read linhas"   on public.linhas;
drop policy if exists "auth write linhas"  on public.linhas;
drop policy if exists "auth update linhas" on public.linhas;
drop policy if exists "auth delete linhas" on public.linhas;
create policy "auth read linhas"   on public.linhas for select to authenticated using (true);
create policy "auth write linhas"  on public.linhas for insert to authenticated with check (true);
create policy "auth update linhas" on public.linhas for update to authenticated using (true) with check (true);
create policy "auth delete linhas" on public.linhas for delete to authenticated using (true);

-- ---------- Migracao dos dados antigos (config_items tipo='linha') ----------
-- Idempotente: so migra se a tabela linhas ainda estiver vazia.
insert into public.linhas (nome)
select trim(valor)
from public.config_items
where tipo = 'linha'
  and not exists (select 1 from public.linhas);

-- Remove os registros antigos da tabela generica (so depois de migrar)
delete from public.config_items
where tipo = 'linha'
  and exists (select 1 from public.linhas);

-- =====================================================================
-- Mave Producao - Adiciona horario de almoco no registro de grampeadeira
-- (duracao do almoco — HH:MM)
-- Rode este arquivo no SQL Editor do projeto Supabase.
-- =====================================================================

alter table public.registros_grampeadeira
  add column if not exists almoco text;

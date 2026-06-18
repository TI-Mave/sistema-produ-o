-- =====================================================================
-- Mave Producao - Desconto de hora (atestado, falta, etc.) na grampeadeira
-- Adiciona colunas em registros_grampeadeira:
--   desconto: boolean (default false)
--   desconto_dados: jsonb { motivo, duracao }
-- Rode este arquivo no SQL Editor do projeto Supabase.
-- =====================================================================

alter table public.registros_grampeadeira
  add column if not exists desconto boolean not null default false,
  add column if not exists desconto_dados jsonb;

-- =====================================================================
-- Mave Producao - Permite que 'tipo' em metas seja qualquer texto
-- (antes era restrito a 'geral' ou 'operador').
-- Rode este arquivo no SQL Editor do projeto Supabase.
-- =====================================================================

alter table public.metas drop constraint if exists metas_tipo_check;

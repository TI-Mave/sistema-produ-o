-- =====================================================================
-- Mave Producao - Remove a coluna 'tipo_caixa' da tabela registros_extensor
-- (Extensor Metro nao usa mais Tipo de Caixa).
-- Rode este arquivo no SQL Editor do projeto Supabase.
-- =====================================================================

alter table public.registros_extensor
  drop column if exists tipo_caixa;

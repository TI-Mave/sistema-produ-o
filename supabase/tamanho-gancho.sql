-- =====================================================================
-- Mave Producao - Adiciona 'tamanho' e 'gancho' aos tipos validos
-- de config_items.
-- Rode este arquivo no SQL Editor do projeto Supabase.
-- =====================================================================

alter table public.config_items drop constraint if exists config_items_tipo_check;
alter table public.config_items add constraint config_items_tipo_check
  check (tipo in ('diametro','caixa','tamanho','gancho'));

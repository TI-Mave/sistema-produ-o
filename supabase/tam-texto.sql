-- =====================================================================
-- Mave Producao - Permite que 'tam' (tamanho) seja texto livre, p.ex. "8m"
-- Converte a coluna numeric -> text. Valores existentes viram strings
-- como "1.50". Rode este arquivo no SQL Editor do Supabase.
-- =====================================================================

alter table public.registros_grampeadeira
  alter column tam type text using tam::text;

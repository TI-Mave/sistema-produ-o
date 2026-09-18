-- =====================================================================
-- Mave Producao - Desconto de horas em colunas proprias (grampeadeira)
-- Substitui o jsonb desconto_dados { motivo, duracao } por duas colunas
-- de texto, no mesmo modelo da coluna almoco — simples de consultar no BI.
-- Rode este arquivo inteiro no SQL Editor do projeto Supabase.
-- =====================================================================

alter table public.registros_grampeadeira
  add column if not exists desconto_motivo  text,
  add column if not exists desconto_duracao text;

-- Backfill a partir do jsonb antigo (so onde as colunas novas ainda estao vazias).
-- Idempotente: rodar de novo nao sobrescreve nada.
update public.registros_grampeadeira
   set desconto_motivo  = coalesce(desconto_motivo,  nullif(btrim(desconto_dados ->> 'motivo'), '')),
       desconto_duracao = coalesce(desconto_duracao, nullif(btrim(desconto_dados ->> 'duracao'), ''))
 where desconto_dados is not null
   and (desconto_motivo is null or desconto_duracao is null);

-- A coluna desconto_dados fica como historico e o app deixa de grava-la.
-- Quando nada mais depender dela (BI, relatorios), pode ser removida:
--   alter table public.registros_grampeadeira drop column desconto_dados;

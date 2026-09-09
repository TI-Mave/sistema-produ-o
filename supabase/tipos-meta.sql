-- =====================================================================
-- Mave Producao - Tipos de Meta cadastraveis (config_items tipo='meta_tipo')
-- + renomeia os tipos usados ate agora nas metas ja registradas:
--   Meta Operador -> Meta Grampeadeira
--   Meta Diaria   -> Meta Corda/Mangueira
-- Rode este arquivo inteiro no SQL Editor do projeto Supabase.
-- =====================================================================

-- 'meta_tipo' passa a ser um tipo valido de item de configuracao
alter table public.config_items drop constraint if exists config_items_tipo_check;
alter table public.config_items add constraint config_items_tipo_check
  check (tipo in ('diametro','caixa','tamanho','gancho','pacote','meta_tipo'));

-- ---------- Renomeia os tipos nas metas ja cadastradas ----------
-- Case-insensitive e tolerante a falta de acento em "Diaria".
update public.metas
   set tipo = 'Meta Grampeadeira'
 where lower(tipo) = 'meta operador';

update public.metas
   set tipo = 'Meta Corda/Mangueira'
 where lower(tipo) in ('meta diária', 'meta diaria');

-- ---------- Seed dos tipos de meta ----------
-- Semeia a lista com os tipos ja em uso (nomes novos) mais os que existiam
-- no datalist fixo do front. Idempotente: nao duplica o que ja estiver la.
insert into public.config_items (tipo, valor)
select 'meta_tipo', v.valor from (values
  ('Meta Geral'),
  ('Meta Grampeadeira'),
  ('Meta Linha'),
  ('Meta Turno'),
  ('Meta Gancho'),
  ('Meta Corda/Mangueira')
) as v(valor)
where not exists (
  select 1 from public.config_items c
   where c.tipo = 'meta_tipo' and lower(c.valor) = lower(v.valor)
);

-- Garante que todo tipo usado por alguma meta exista na lista cadastrada
-- (protege tipos digitados a mao antes desta migracao).
insert into public.config_items (tipo, valor)
select distinct 'meta_tipo', m.tipo
  from public.metas m
 where m.tipo is not null
   and btrim(m.tipo) <> ''
   and not exists (
     select 1 from public.config_items c
      where c.tipo = 'meta_tipo' and lower(c.valor) = lower(m.tipo)
   );

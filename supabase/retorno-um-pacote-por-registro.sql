-- =====================================================================
-- Mave Producao - Retorno Industrializado: um registro por tipo de pacote
-- Divide os registros antigos que guardavam varios tipos de pacote no
-- mesmo lancamento (ex.: {"PCT 10": 1000, "PCT 50": 2000}) em um registro
-- para cada tipo, com o total igual a quantidade daquele pacote.
-- Idempotente: rodar de novo nao faz nada se ja estiver tudo dividido.
-- Rode este arquivo inteiro no SQL Editor do projeto Supabase.
-- =====================================================================

-- Cria um registro para cada tipo de pacote dos lancamentos multiplos.
-- O SELECT le o estado da tabela no inicio do comando, entao as linhas
-- recem-inseridas (que ja tem um unico pacote) nao entram no proprio insert.
insert into public.registros_retorno (user_id, hora, data, tamanho, pacotes, total, created_at)
select r.user_id,
       r.hora,
       r.data,
       r.tamanho,
       jsonb_build_object(p.key, p.value),
       (p.value #>> '{}')::numeric,
       r.created_at
  from public.registros_retorno r
  cross join lateral jsonb_each(r.pacotes) as p(key, value)
 where (select count(*) from jsonb_object_keys(r.pacotes)) > 1;

-- Remove os lancamentos multiplos originais, ja substituidos acima.
delete from public.registros_retorno r
 where (select count(*) from jsonb_object_keys(r.pacotes)) > 1;

-- =====================================================================
-- Mave Producao - Adiciona horario de almoco aos turnos
-- (cada turno pode ter seu proprio intervalo de almoco)
-- Rode este arquivo no SQL Editor do projeto Supabase.
-- =====================================================================

alter table public.turnos
  add column if not exists almoco_inicio text,
  add column if not exists almoco_fim text;

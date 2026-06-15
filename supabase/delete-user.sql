-- =====================================================================
-- Mave Producao - RPC para admin remover um usuario completamente
-- (apaga em user_profiles e auth.users). Apenas admins podem executar.
-- Rode este arquivo no SQL Editor do projeto Supabase.
-- =====================================================================

create or replace function public.delete_user_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_role text;
begin
  -- Confere se quem chamou eh admin
  select role into caller_role from public.user_profiles where id = auth.uid();
  if caller_role is null or caller_role <> 'admin' then
    raise exception 'Apenas administradores podem remover usuários.'
      using errcode = '42501';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Você não pode remover a si mesmo.'
      using errcode = '22023';
  end if;

  delete from public.user_profiles where id = target_user_id;
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.delete_user_account(uuid) from public;
grant execute on function public.delete_user_account(uuid) to authenticated;

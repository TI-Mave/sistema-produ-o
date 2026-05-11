-- =====================================================================
-- Restringe cadastros a e-mails @mavebr.com
-- Rode este arquivo uma vez no SQL Editor do Supabase.
-- E idempotente: pode rodar de novo sem efeitos colaterais.
-- =====================================================================

create or replace function public.enforce_mavebr_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or lower(new.email) !~ '@mavebr\.com$' then
    raise exception 'Apenas e-mails @mavebr.com são permitidos.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_mavebr_domain_trigger on auth.users;
create trigger enforce_mavebr_domain_trigger
  before insert on auth.users
  for each row execute function public.enforce_mavebr_domain();

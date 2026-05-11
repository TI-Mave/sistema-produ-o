-- =====================================================================
-- Mave Producao - Schema Supabase
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase.
-- Modelo: dados compartilhados entre todos usuarios autenticados.
-- =====================================================================

-- ---------- Cores (com hex) ----------
create table if not exists public.cores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  hex  text not null default '#8A857C',
  created_at timestamptz not null default now()
);

-- ---------- Itens de configuracao simples (lista de strings) ----------
create table if not exists public.config_items (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('diametro','caixa','linha','turno','operador','meta')),
  valor text not null,
  created_at timestamptz not null default now()
);
create index if not exists config_items_tipo_idx on public.config_items(tipo);

-- ---------- Registros: Trancadeira ----------
create table if not exists public.registros_trancadeira (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  hora text not null,
  data date not null,
  tipo_caixa text not null,
  linha text not null,
  cor text not null,
  diametro text not null,
  peso numeric(10,2) not null,
  created_at timestamptz not null default now()
);
create index if not exists registros_trancadeira_data_idx on public.registros_trancadeira(data);

-- ---------- Registros: Grampeadeira ----------
create table if not exists public.registros_grampeadeira (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  hora text not null,
  data date not null,
  op text not null,
  hi text not null,
  hf text not null,
  operador text not null,
  qtd integer not null,
  tam numeric(10,2) not null,
  gancho text not null,
  he boolean not null default false,
  he_dados jsonb,
  created_at timestamptz not null default now()
);
create index if not exists registros_grampeadeira_data_idx on public.registros_grampeadeira(data);

-- ---------- Registros: Extensor Metro ----------
create table if not exists public.registros_extensor (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  hora text not null,
  data date not null,
  tipo_caixa text not null,
  cor text not null,
  diametro text not null,
  qtd integer not null,
  created_at timestamptz not null default now()
);
create index if not exists registros_extensor_data_idx on public.registros_extensor(data);

-- =====================================================================
-- RLS: usuarios autenticados podem ler e escrever tudo (chao de fabrica)
-- =====================================================================
alter table public.cores                  enable row level security;
alter table public.config_items           enable row level security;
alter table public.registros_trancadeira  enable row level security;
alter table public.registros_grampeadeira enable row level security;
alter table public.registros_extensor     enable row level security;

-- Cores
drop policy if exists "auth read cores"   on public.cores;
drop policy if exists "auth write cores"  on public.cores;
drop policy if exists "auth update cores" on public.cores;
drop policy if exists "auth delete cores" on public.cores;
create policy "auth read cores"   on public.cores for select to authenticated using (true);
create policy "auth write cores"  on public.cores for insert to authenticated with check (true);
create policy "auth update cores" on public.cores for update to authenticated using (true) with check (true);
create policy "auth delete cores" on public.cores for delete to authenticated using (true);

-- Config items
drop policy if exists "auth read config"   on public.config_items;
drop policy if exists "auth write config"  on public.config_items;
drop policy if exists "auth update config" on public.config_items;
drop policy if exists "auth delete config" on public.config_items;
create policy "auth read config"   on public.config_items for select to authenticated using (true);
create policy "auth write config"  on public.config_items for insert to authenticated with check (true);
create policy "auth update config" on public.config_items for update to authenticated using (true) with check (true);
create policy "auth delete config" on public.config_items for delete to authenticated using (true);

-- Registros trancadeira
drop policy if exists "auth read trancadeira"   on public.registros_trancadeira;
drop policy if exists "auth write trancadeira"  on public.registros_trancadeira;
drop policy if exists "auth update trancadeira" on public.registros_trancadeira;
drop policy if exists "auth delete trancadeira" on public.registros_trancadeira;
create policy "auth read trancadeira"   on public.registros_trancadeira for select to authenticated using (true);
create policy "auth write trancadeira"  on public.registros_trancadeira for insert to authenticated with check (true);
create policy "auth update trancadeira" on public.registros_trancadeira for update to authenticated using (true) with check (true);
create policy "auth delete trancadeira" on public.registros_trancadeira for delete to authenticated using (true);

-- Registros grampeadeira
drop policy if exists "auth read grampeadeira"   on public.registros_grampeadeira;
drop policy if exists "auth write grampeadeira"  on public.registros_grampeadeira;
drop policy if exists "auth update grampeadeira" on public.registros_grampeadeira;
drop policy if exists "auth delete grampeadeira" on public.registros_grampeadeira;
create policy "auth read grampeadeira"   on public.registros_grampeadeira for select to authenticated using (true);
create policy "auth write grampeadeira"  on public.registros_grampeadeira for insert to authenticated with check (true);
create policy "auth update grampeadeira" on public.registros_grampeadeira for update to authenticated using (true) with check (true);
create policy "auth delete grampeadeira" on public.registros_grampeadeira for delete to authenticated using (true);

-- Registros extensor
drop policy if exists "auth read extensor"   on public.registros_extensor;
drop policy if exists "auth write extensor"  on public.registros_extensor;
drop policy if exists "auth update extensor" on public.registros_extensor;
drop policy if exists "auth delete extensor" on public.registros_extensor;
create policy "auth read extensor"   on public.registros_extensor for select to authenticated using (true);
create policy "auth write extensor"  on public.registros_extensor for insert to authenticated with check (true);
create policy "auth update extensor" on public.registros_extensor for update to authenticated using (true) with check (true);
create policy "auth delete extensor" on public.registros_extensor for delete to authenticated using (true);

-- =====================================================================
-- Seeds iniciais (espelham DEFAULT_CONFIG do app.js)
-- Idempotente: so insere se a tabela estiver vazia.
-- =====================================================================
insert into public.cores (nome, hex)
select v.nome, v.hex from (values
  ('Preto','#1A1814'),
  ('Branco','#FFFFFF'),
  ('Azul','#2563EB'),
  ('Vermelho','#DC2626')
) as v(nome, hex)
where not exists (select 1 from public.cores);

insert into public.config_items (tipo, valor)
select v.tipo, v.valor from (values
  ('diametro','2.5'),
  ('diametro','3.0'),
  ('diametro','4.0'),
  ('diametro','5.0'),
  ('caixa','Caixa 1Kg'),
  ('caixa','Caixa 3.5Kg'),
  ('linha','Linha 1'),
  ('linha','Linha 2'),
  ('linha','Linha 3'),
  ('turno','Turno A · 06:00 às 14:00'),
  ('turno','Turno B · 14:00 às 22:00'),
  ('turno','Turno C · 22:00 às 06:00'),
  ('operador','João Silva (12345)'),
  ('operador','Maria Souza (12346)'),
  ('operador','Pedro Lima (12347)'),
  ('meta','Meta Geral · 1000/dia'),
  ('meta','João Silva · 350/dia')
) as v(tipo, valor)
where not exists (select 1 from public.config_items);

-- =====================================================================
-- Restricao de dominio: somente cadastros com @mavebr.com sao aceitos
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

-- =====================================================================
-- Caderno da Fazenda Rockefeller — Schema Supabase
-- Execute em: Supabase Dashboard > SQL Editor (Run)
-- =====================================================================

-- ---------- Extensões ----------
create extension if not exists "pgcrypto";

-- ---------- Enums ----------
do $$ begin
  create type user_role as enum ('proprietario','gerente','trabalhador');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'rascunho','aprovado','em_producao','entregue','pago','concluido','cancelado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type claim_status as enum ('em_producao','entregue','pago','cancelado');
exception when duplicate_object then null; end $$;

-- ---------- Perfis (1:1 com auth.users) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome_completo text not null,
  identificacao text not null,
  discord_handle text not null,
  conta_bancaria text not null,
  role user_role not null default 'trabalhador',
  criado_em timestamptz not null default now()
);

-- Auto-criação do profile vazio no signup (preenchido depois pelo usuário)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome_completo, identificacao, discord_handle, conta_bancaria, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    '',
    coalesce(new.raw_user_meta_data->>'preferred_username',''),
    '',
    'trabalhador'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- Catálogo de produtos ----------
create table if not exists products (
  id serial primary key,
  nome text not null unique,
  categoria text not null,
  preco_min numeric(10,2) not null,
  preco_max numeric(10,2) not null
);

-- ---------- Pedidos ----------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  numero_nota text not null,
  cliente text,
  anotacoes text,
  desconto_pct numeric(5,2) not null default 0,
  status order_status not null default 'rascunho',
  prazo_entrega timestamptz,
  criado_por uuid not null references profiles(id),
  aprovado_por uuid references profiles(id),
  aprovado_em timestamptz,
  concluido_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_criado_por_idx on orders(criado_por);

-- ---------- Itens do pedido ----------
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id int not null references products(id),
  quantidade int not null check (quantidade > 0),
  preco_unit numeric(10,2) not null
);
create index if not exists order_items_order_idx on order_items(order_id);

-- ---------- Claims (trabalhador assume parte da produção) ----------
create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  trabalhador_id uuid not null references profiles(id),
  data_prevista_entrega timestamptz not null,
  status claim_status not null default 'em_producao',
  entregue_em timestamptz,
  pago_em timestamptz,
  pago_por uuid references profiles(id),
  criado_em timestamptz not null default now()
);
create index if not exists claims_order_idx on claims(order_id);
create index if not exists claims_trabalhador_idx on claims(trabalhador_id);

create table if not exists claim_items (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claims(id) on delete cascade,
  order_item_id uuid not null references order_items(id),
  quantidade int not null check (quantidade > 0)
);
create index if not exists claim_items_claim_idx on claim_items(claim_id);

-- ---------- View: itens em aberto (saldo a produzir por item) ----------
create or replace view order_item_balance as
select
  oi.id as order_item_id,
  oi.order_id,
  oi.product_id,
  oi.quantidade as quantidade_total,
  coalesce(sum(ci.quantidade) filter (where c.status in ('em_producao','entregue','pago')), 0) as quantidade_assumida,
  oi.quantidade - coalesce(sum(ci.quantidade) filter (where c.status in ('em_producao','entregue','pago')), 0) as quantidade_em_aberto
from order_items oi
left join claim_items ci on ci.order_item_id = oi.id
left join claims c on c.id = ci.claim_id
group by oi.id;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table profiles      enable row level security;
alter table products      enable row level security;
alter table orders        enable row level security;
alter table order_items   enable row level security;
alter table claims        enable row level security;
alter table claim_items   enable row level security;

-- Helper: role do usuário atual
create or replace function public.current_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

-- ----- profiles -----
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select using (true);  -- todos autenticados veem nomes (necessário para listas)

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
-- (impede o próprio usuário de mudar a sua role)

drop policy if exists profiles_update_owner on profiles;
create policy profiles_update_owner on profiles
  for update using (current_role() = 'proprietario');

-- ----- products -----
drop policy if exists products_select on products;
create policy products_select on products for select using (auth.role() = 'authenticated');

drop policy if exists products_write on products;
create policy products_write on products for all
  using (current_role() in ('proprietario','gerente'))
  with check (current_role() in ('proprietario','gerente'));

-- ----- orders -----
drop policy if exists orders_select on orders;
create policy orders_select on orders for select using (auth.role() = 'authenticated');

drop policy if exists orders_insert_gerente on orders;
create policy orders_insert_gerente on orders for insert
  with check (current_role() in ('proprietario','gerente') and criado_por = auth.uid());

drop policy if exists orders_update_gerente on orders;
create policy orders_update_gerente on orders for update
  using (current_role() in ('proprietario','gerente'));

-- ----- order_items -----
drop policy if exists order_items_select on order_items;
create policy order_items_select on order_items for select using (auth.role() = 'authenticated');

drop policy if exists order_items_write_gerente on order_items;
create policy order_items_write_gerente on order_items for all
  using (current_role() in ('proprietario','gerente'))
  with check (current_role() in ('proprietario','gerente'));

-- ----- claims -----
drop policy if exists claims_select on claims;
create policy claims_select on claims for select using (auth.role() = 'authenticated');

drop policy if exists claims_insert_self on claims;
create policy claims_insert_self on claims for insert
  with check (trabalhador_id = auth.uid());

drop policy if exists claims_update_self on claims;
create policy claims_update_self on claims for update
  using (trabalhador_id = auth.uid() and status = 'em_producao');

drop policy if exists claims_update_gerente on claims;
create policy claims_update_gerente on claims for update
  using (current_role() in ('proprietario','gerente'));

-- ----- claim_items -----
drop policy if exists claim_items_select on claim_items;
create policy claim_items_select on claim_items for select using (auth.role() = 'authenticated');

drop policy if exists claim_items_write on claim_items;
create policy claim_items_write on claim_items for all
  using (
    exists (
      select 1 from claims c
      where c.id = claim_items.claim_id
        and (c.trabalhador_id = auth.uid() or current_role() in ('proprietario','gerente'))
    )
  )
  with check (
    exists (
      select 1 from claims c
      where c.id = claim_items.claim_id
        and (c.trabalhador_id = auth.uid() or current_role() in ('proprietario','gerente'))
    )
  );

-- =====================================================================
-- SEED: catálogo de produtos (do legado produtos.js)
-- =====================================================================
insert into products (nome, categoria, preco_min, preco_max) values
('Açúcar','Especiarias & Outros',0.50,0.60),
('Algodão','Matérias-primas',0.40,0.50),
('Alho','Frutas, Grãos & Vegetais',0.40,0.50),
('Ameixa','Frutas, Grãos & Vegetais',0.40,0.50),
('Amora','Frutas, Grãos & Vegetais',0.40,0.50),
('Banana','Frutas, Grãos & Vegetais',0.40,0.50),
('Batata','Frutas, Grãos & Vegetais',0.40,0.50),
('Cacau','Especiarias & Outros',0.40,0.50),
('Café','Especiarias & Outros',0.40,0.50),
('Cana-de-açúcar','Frutas, Grãos & Vegetais',0.40,0.50),
('Carne de Porco','Animais & Insumos',0.60,0.80),
('Carne de Vaca','Animais & Insumos',1.50,2.00),
('Cenoura','Frutas, Grãos & Vegetais',0.40,0.50),
('Coalhada','Laticínios',1.20,1.50),
('Couro de Cavalo','Animais & Insumos',0.80,1.00),
('Fertilizante','Matérias-primas',0.50,0.80),
('Giseng Americano','Especiarias & Outros',0.40,0.50),
('Giseng-do-Alaska','Especiarias & Outros',0.40,0.50),
('Hortelã','Especiarias & Outros',0.40,0.50),
('Lã de Ovelha','Matérias-primas',0.50,0.60),
('Laranja','Frutas, Grãos & Vegetais',0.40,0.50),
('Leite','Laticínios',0.50,0.60),
('Leite de Cabra','Laticínios',0.60,0.75),
('Lúpulo','Especiarias & Outros',0.40,0.50),
('Maçã','Frutas, Grãos & Vegetais',0.40,0.50),
('Manteiga','Laticínios',1.70,2.30),
('Milho','Frutas, Grãos & Vegetais',0.40,0.50),
('Orégano','Especiarias & Outros',0.40,0.50),
('Ovo','Animais & Insumos',0.60,0.80),
('Pêssego','Frutas, Grãos & Vegetais',0.40,0.50),
('Queijo','Laticínios',1.20,1.50),
('Queijo de Cabra','Laticínios',2.00,2.50),
('Ração','Animais & Insumos',15.00,18.00),
('Requeijão','Laticínios',3.60,4.50),
('Ricota','Laticínios',1.20,1.50),
('Saco de Algodão','Sacos',15.00,18.00),
('Saco de Alho','Sacos',15.00,18.00),
('Saco de Ameixa','Sacos',15.00,18.00),
('Saco de Amora','Sacos',15.00,18.00),
('Saco de Banana','Sacos',15.00,18.00),
('Saco de Batata','Sacos',15.00,18.00),
('Saco de Cacau','Sacos',15.00,18.00),
('Saco de Café','Sacos',15.00,18.00),
('Saco de Cana-de-açúcar','Sacos',15.00,18.00),
('Saco de Cenoura','Sacos',15.00,18.00),
('Saco de Giseng Americano','Sacos',15.00,18.00),
('Saco de Giseng-do-Alaska','Sacos',15.00,18.00),
('Saco de Hortelã','Sacos',15.00,18.00),
('Saco de Laranja','Sacos',15.00,18.00),
('Saco de Lúpulo','Sacos',15.00,18.00),
('Saco de Maçã','Sacos',15.00,18.00),
('Saco de Milho','Sacos',15.00,18.00),
('Saco de Orégano','Sacos',15.00,18.00),
('Saco de Pêssego','Sacos',15.00,18.00),
('Saco de Tomilho','Sacos',15.00,18.00),
('Saco de Trigo','Sacos',15.00,18.00),
('Saco de Uva','Sacos',15.00,18.00),
('Tabaco','Especiarias & Outros',0.40,0.50),
('Tomilho','Especiarias & Outros',0.40,0.50),
('Trigo','Frutas, Grãos & Vegetais',0.40,0.50),
('Uva','Frutas, Grãos & Vegetais',0.40,0.50)
on conflict (nome) do nothing;

-- =====================================================================
-- COMISSÃO da Fazenda: 25% (trabalhador recebe 75% do valor produzido).
-- O valor é calculado no front (constante COMISSAO_PCT em src/lib/calc.js).
-- =====================================================================

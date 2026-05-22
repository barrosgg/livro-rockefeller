-- =====================================================================
-- Migration 006 — Recursos Avançados de Admin
-- 1. Audit log (trigger em orders/claims/profiles)
-- 2. Templates de pedido
-- 3. Notas internas no pedido
-- 4. Categorias custom (em settings)
-- =====================================================================

-- ---------- 1. AUDIT LOG ----------
create table if not exists audit_log (
  id         bigserial primary key,
  actor_id   uuid references profiles(id),
  action     text not null,                  -- ex: 'order.aprovado', 'claim.pago'
  entity_type text not null,                 -- 'order' | 'claim' | 'profile'
  entity_id  text not null,                  -- id (uuid ou text) da entidade
  payload    jsonb,                          -- snapshot relevante
  criado_em  timestamptz not null default now()
);

create index if not exists audit_log_criado_idx     on audit_log(criado_em desc);
create index if not exists audit_log_entity_idx     on audit_log(entity_type, entity_id);
create index if not exists audit_log_actor_idx      on audit_log(actor_id);

alter table audit_log enable row level security;
drop policy if exists audit_log_select on audit_log;
create policy audit_log_select on audit_log for select
  using (app_role() in ('proprietario','gerente'));
grant select on audit_log to authenticated;
grant insert on audit_log to authenticated;   -- pra triggers e RPCs
grant usage on sequence audit_log_id_seq to authenticated;

-- Helper para logar (chamado pelos triggers)
create or replace function public.log_event(
  p_action text, p_entity_type text, p_entity_id text, p_payload jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (actor_id, action, entity_type, entity_id, payload)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_payload);
end $$;

-- Trigger orders — registra mudanças de status
create or replace function public.audit_orders() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform log_event('order.criado', 'order', new.id::text,
      jsonb_build_object('status', new.status, 'numero_nota', new.numero_nota, 'cliente', new.cliente));
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    perform log_event('order.status_' || new.status, 'order', new.id::text,
      jsonb_build_object('de', old.status, 'para', new.status, 'numero_nota', new.numero_nota));
  end if;
  return new;
end $$;
drop trigger if exists trg_audit_orders on orders;
create trigger trg_audit_orders
  after insert or update on orders
  for each row execute procedure public.audit_orders();

-- Trigger claims
create or replace function public.audit_claims() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform log_event('claim.criado', 'claim', new.id::text,
      jsonb_build_object('order_id', new.order_id, 'trabalhador_id', new.trabalhador_id));
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    perform log_event('claim.status_' || new.status, 'claim', new.id::text,
      jsonb_build_object('order_id', new.order_id, 'de', old.status, 'para', new.status));
  end if;
  return new;
end $$;
drop trigger if exists trg_audit_claims on claims;
create trigger trg_audit_claims
  after insert or update on claims
  for each row execute procedure public.audit_claims();

-- Trigger profiles — role/disabled
create or replace function public.audit_profiles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.role is distinct from new.role then
    perform log_event('profile.role_changed', 'profile', new.id::text,
      jsonb_build_object('de', old.role, 'para', new.role));
  end if;
  if tg_op = 'UPDATE' and old.disabled is distinct from new.disabled then
    perform log_event(case when new.disabled then 'profile.desabilitado' else 'profile.reativado' end,
      'profile', new.id::text, jsonb_build_object('disabled', new.disabled));
  end if;
  return new;
end $$;
drop trigger if exists trg_audit_profiles on profiles;
create trigger trg_audit_profiles
  after update on profiles
  for each row execute procedure public.audit_profiles();

-- ---------- 2. ORDER TEMPLATES ----------
create table if not exists order_templates (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  descricao   text,
  criado_por  uuid not null references profiles(id),
  criado_em   timestamptz not null default now()
);

create table if not exists order_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references order_templates(id) on delete cascade,
  product_id  int not null references products(id),
  quantidade  int not null check (quantidade > 0),
  preco_unit  numeric(10,2) not null
);

create index if not exists tpl_items_template_idx on order_template_items(template_id);

alter table order_templates       enable row level security;
alter table order_template_items  enable row level security;

drop policy if exists tpl_select on order_templates;
create policy tpl_select on order_templates for select using (auth.role() = 'authenticated');

drop policy if exists tpl_write on order_templates;
create policy tpl_write on order_templates for all
  using (app_role() in ('proprietario','gerente'))
  with check (app_role() in ('proprietario','gerente') and criado_por = auth.uid());

drop policy if exists tpl_items_select on order_template_items;
create policy tpl_items_select on order_template_items for select using (auth.role() = 'authenticated');

drop policy if exists tpl_items_write on order_template_items;
create policy tpl_items_write on order_template_items for all
  using (app_role() in ('proprietario','gerente'))
  with check (app_role() in ('proprietario','gerente'));

grant select, insert, update, delete on order_templates to authenticated;
grant select, insert, update, delete on order_template_items to authenticated;

-- ---------- 3. NOTAS INTERNAS ----------
alter table orders add column if not exists notas_internas text;
-- (não muda RLS — orders já é select all auth; notas_internas só será
--  exibida no front para gerente/proprietario)

-- ---------- 4. CATEGORIAS CUSTOM ----------
insert into settings (key, value) values
  ('categorias', '[
    "Frutas, Grãos & Vegetais",
    "Laticínios",
    "Animais & Insumos",
    "Especiarias & Outros",
    "Matérias-primas",
    "Sacos"
  ]'::jsonb)
on conflict (key) do nothing;

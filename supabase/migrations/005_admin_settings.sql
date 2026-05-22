-- =====================================================================
-- Migration 005 — Painel Admin: settings + disabled em profiles
-- =====================================================================

-- ---------- settings (key/value JSON) ----------
create table if not exists settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references profiles(id)
);

-- valores iniciais
insert into settings (key, value) values
  ('commission_pct', '0.25'::jsonb),
  ('farm_name',      '"Fazenda Rockefeller"'::jsonb)
on conflict (key) do nothing;

-- RLS
alter table settings enable row level security;

drop policy if exists settings_select on settings;
create policy settings_select on settings for select
  using (auth.role() = 'authenticated');

drop policy if exists settings_write on settings;
create policy settings_write on settings for all
  using (app_role() = 'proprietario')
  with check (app_role() = 'proprietario');

grant select on settings to authenticated;
grant insert, update, delete on settings to authenticated;

-- ---------- profiles.disabled ----------
alter table profiles add column if not exists disabled boolean not null default false;

-- Ajusta o trigger guard pra impedir trabalhador desabilitar a si mesmo
create or replace function public.prevent_role_self_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and app_role() is distinct from 'proprietario' then
    raise exception 'Apenas o Proprietário pode alterar papéis (role).';
  end if;
  if new.disabled is distinct from old.disabled and app_role() is distinct from 'proprietario' then
    raise exception 'Apenas o Proprietário pode habilitar/desabilitar acesso.';
  end if;
  return new;
end $$;

-- ---------- products: permissão de inserir/editar ----------
-- (já existe products_write para proprietario/gerente, mantém)
-- Garantia explicita: gerente tambem pode adicionar produto
drop policy if exists products_write on products;
create policy products_write on products for all
  using (app_role() in ('proprietario','gerente'))
  with check (app_role() in ('proprietario','gerente'));

-- =====================================================================
-- Migration 003 — Códigos curtos para URLs de pedido
-- =====================================================================

-- Gerador de código alfanumérico (sem 0/O/1/I/L para evitar confusão visual)
create or replace function public.gen_alpha_code(len int default 6)
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..len loop
    result := result || substr(chars, floor(random() * length(chars))::int + 1, 1);
  end loop;
  return result;
end $$;

-- Código interno (6 chars) e público (10 chars)
alter table orders add column if not exists short_code  text;
alter table orders add column if not exists public_code text;

-- Backfill (gera até achar valor único pra cada linha existente)
do $$
declare r record; tentativa text;
begin
  for r in select id from orders where short_code is null loop
    loop
      tentativa := public.gen_alpha_code(6);
      begin
        update orders set short_code = tentativa where id = r.id;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
  end loop;

  for r in select id from orders where public_code is null loop
    loop
      tentativa := public.gen_alpha_code(10);
      begin
        update orders set public_code = tentativa where id = r.id;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
  end loop;
end $$;

-- NOT NULL + UNIQUE + DEFAULT
alter table orders alter column short_code  set not null;
alter table orders alter column public_code set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_short_code_unique') then
    alter table orders add constraint orders_short_code_unique  unique(short_code);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_public_code_unique') then
    alter table orders add constraint orders_public_code_unique unique(public_code);
  end if;
end $$;

alter table orders alter column short_code  set default public.gen_alpha_code(6);
alter table orders alter column public_code set default public.gen_alpha_code(10);

create index if not exists orders_short_code_idx  on orders(short_code);
create index if not exists orders_public_code_idx on orders(public_code);

-- Atualiza RPC pública para aceitar public_code (e como fallback, public_token antigo)
create or replace function public.get_order_public(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o record;
  itens jsonb;
  cls jsonb;
begin
  -- Tenta primeiro pelo código curto. Se parecer UUID, tenta também pelo token antigo.
  select * into o from orders
  where public_code = p_code
     or (length(p_code) = 36 and p_code ~ '^[0-9a-f-]+$' and public_token::text = p_code)
  limit 1;

  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', oi.id,
    'quantidade', oi.quantidade,
    'preco_unit', oi.preco_unit,
    'product', jsonb_build_object('nome', p.nome, 'categoria', p.categoria)
  ) order by p.nome), '[]'::jsonb)
  into itens
  from order_items oi join products p on p.id = oi.product_id
  where oi.order_id = o.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'status', c.status,
    'data_prevista_entrega', c.data_prevista_entrega,
    'entregue_em', c.entregue_em, 'pago_em', c.pago_em,
    'trabalhador', jsonb_build_object(
      'nome_completo', tp.nome_completo,
      'discord_handle', tp.discord_handle
    ),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'quantidade', ci.quantidade,
        'product', jsonb_build_object('nome', cp.nome)
      )), '[]'::jsonb)
      from claim_items ci
      join order_items coi on coi.id = ci.order_item_id
      join products cp on cp.id = coi.product_id
      where ci.claim_id = c.id
    )
  ) order by c.criado_em), '[]'::jsonb)
  into cls
  from claims c
  join profiles tp on tp.id = c.trabalhador_id
  where c.order_id = o.id;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id, 'numero_nota', o.numero_nota, 'cliente', o.cliente,
      'anotacoes', o.anotacoes, 'desconto_pct', o.desconto_pct,
      'status', o.status, 'prazo_entrega', o.prazo_entrega,
      'aprovado_em', o.aprovado_em, 'concluido_em', o.concluido_em,
      'criado_em', o.criado_em, 'short_code', o.short_code, 'public_code', o.public_code
    ),
    'items', itens,
    'claims', cls
  );
end $$;

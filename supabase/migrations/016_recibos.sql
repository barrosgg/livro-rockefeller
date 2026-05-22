-- =====================================================================
-- Migration 016 — Recibos públicos de produção
-- =====================================================================

alter table claims add column if not exists public_code text;

-- Backfill
do $$
declare r record; tentativa text;
begin
  for r in select id from claims where public_code is null loop
    loop
      tentativa := public.gen_alpha_code(10);
      begin
        update claims set public_code = tentativa where id = r.id;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
  end loop;
end $$;

alter table claims alter column public_code set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'claims_public_code_unique') then
    alter table claims add constraint claims_public_code_unique unique(public_code);
  end if;
end $$;

alter table claims alter column public_code set default public.gen_alpha_code(10);
create index if not exists claims_public_code_idx on claims(public_code);

-- RPC: retorna o recibo público (apenas para claims já pagos)
create or replace function public.get_recibo_public(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c record; o record; items jsonb; trab record; bruto numeric;
begin
  select * into c from claims where public_code = p_code;
  if not found then
    raise exception 'Recibo não encontrado' using errcode = 'P0002';
  end if;
  if c.status not in ('pago') then
    raise exception 'Recibo disponível apenas após o pagamento' using errcode = 'P0002';
  end if;

  select * into o from orders where id = c.order_id;
  select nome_completo, identificacao, conta_bancaria, discord_handle, avatar
    into trab from profiles where id = c.trabalhador_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'quantidade', ci.quantidade,
    'preco_unit', oi.preco_unit,
    'subtotal', ci.quantidade * oi.preco_unit,
    'product', jsonb_build_object('nome', p.nome, 'icon', p.icon)
  ) order by p.nome), '[]'::jsonb)
  into items
  from claim_items ci
  join order_items oi on oi.id = ci.order_item_id
  join products p on p.id = oi.product_id
  where ci.claim_id = c.id;

  select coalesce(sum(ci.quantidade * oi.preco_unit), 0) into bruto
  from claim_items ci
  join order_items oi on oi.id = ci.order_item_id
  where ci.claim_id = c.id;

  return jsonb_build_object(
    'claim', jsonb_build_object(
      'id', c.id, 'public_code', c.public_code, 'status', c.status,
      'data_prevista_entrega', c.data_prevista_entrega,
      'entregue_em', c.entregue_em, 'pago_em', c.pago_em,
      'criado_em', c.criado_em
    ),
    'order', jsonb_build_object(
      'numero_nota', o.numero_nota, 'cliente', o.cliente,
      'short_code', o.short_code
    ),
    'trabalhador', jsonb_build_object(
      'nome_completo', trab.nome_completo,
      'identificacao', trab.identificacao,
      'conta_bancaria', trab.conta_bancaria,
      'avatar', trab.avatar
    ),
    'items', items,
    'bruto', bruto
  );
end $$;

grant execute on function public.get_recibo_public(text) to anon, authenticated;

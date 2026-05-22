-- =====================================================================
-- Migration 002 — Link público do pedido para o cliente acompanhar
-- =====================================================================

-- Token público (UUID aleatório, único, default por linha)
alter table orders
  add column if not exists public_token uuid not null default gen_random_uuid() unique;

-- RPC que retorna o pedido + itens + claims (sem expor email/conta bancária)
-- Pode ser chamada por anon ou authenticated. RLS é bypassado por security definer.
create or replace function public.get_order_public(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o record;
  itens jsonb;
  cls jsonb;
begin
  select * into o from orders where public_token = p_token;
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
    'id', c.id,
    'status', c.status,
    'data_prevista_entrega', c.data_prevista_entrega,
    'entregue_em', c.entregue_em,
    'pago_em', c.pago_em,
    'trabalhador', jsonb_build_object(
      'nome_completo', tp.nome_completo,
      'discord_handle', tp.discord_handle
      -- omite identificação e conta bancária — público
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
      'id', o.id,
      'numero_nota', o.numero_nota,
      'cliente', o.cliente,
      'anotacoes', o.anotacoes,
      'desconto_pct', o.desconto_pct,
      'status', o.status,
      'prazo_entrega', o.prazo_entrega,
      'aprovado_em', o.aprovado_em,
      'concluido_em', o.concluido_em,
      'criado_em', o.criado_em
    ),
    'items', itens,
    'claims', cls
  );
end $$;

grant execute on function public.get_order_public(uuid) to anon, authenticated;

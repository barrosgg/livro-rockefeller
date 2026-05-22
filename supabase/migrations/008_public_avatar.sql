-- =====================================================================
-- Migration 008 — Inclui avatar do trabalhador no RPC público
-- =====================================================================
create or replace function public.get_order_public(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o record; itens jsonb; cls jsonb;
begin
  select * into o from orders
  where public_code = p_code
     or (length(p_code) = 36 and p_code ~ '^[0-9a-f-]+$' and public_token::text = p_code)
  limit 1;
  if not found then raise exception 'Pedido não encontrado' using errcode = 'P0002'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', oi.id, 'quantidade', oi.quantidade, 'preco_unit', oi.preco_unit,
    'product', jsonb_build_object('nome', p.nome, 'categoria', p.categoria)
  ) order by p.nome), '[]'::jsonb) into itens
  from order_items oi join products p on p.id = oi.product_id where oi.order_id = o.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'status', c.status,
    'data_prevista_entrega', c.data_prevista_entrega,
    'entregue_em', c.entregue_em, 'pago_em', c.pago_em,
    'trabalhador', jsonb_build_object(
      'nome_completo', tp.nome_completo,
      'discord_handle', tp.discord_handle,
      'avatar', tp.avatar
    ),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
      'quantidade', ci.quantidade, 'product', jsonb_build_object('nome', cp.nome)
    )), '[]'::jsonb) from claim_items ci join order_items coi on coi.id = ci.order_item_id
      join products cp on cp.id = coi.product_id where ci.claim_id = c.id)
  ) order by c.criado_em), '[]'::jsonb) into cls
  from claims c join profiles tp on tp.id = c.trabalhador_id where c.order_id = o.id;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id, 'numero_nota', o.numero_nota, 'cliente', o.cliente,
      'anotacoes', o.anotacoes, 'desconto_pct', o.desconto_pct, 'status', o.status,
      'prazo_entrega', o.prazo_entrega, 'aprovado_em', o.aprovado_em,
      'concluido_em', o.concluido_em, 'criado_em', o.criado_em,
      'short_code', o.short_code, 'public_code', o.public_code
    ),
    'items', itens, 'claims', cls
  );
end $$;

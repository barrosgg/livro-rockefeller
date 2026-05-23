-- 022_admin_user_details.sql
-- RPC para o Admin obter detalhes completos de um membro:
-- perfil + dados Discord (auth.users) + stats agregadas + conquistas.

create or replace function get_user_admin_details(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  profile_data jsonb;
  auth_data    jsonb;
  stats        jsonb;
  comm_pct     numeric;
begin
  -- Só proprietário pode chamar
  if app_role() <> 'proprietario' then
    raise exception 'Apenas o proprietário pode ver detalhes administrativos';
  end if;

  -- Perfil
  select to_jsonb(p) into profile_data
  from profiles p where p.id = p_user_id;

  if profile_data is null then
    raise exception 'Membro não encontrado';
  end if;

  -- Auth (Discord)
  select jsonb_build_object(
    'email',              au.email,
    'created_at',         au.created_at,
    'last_sign_in_at',    au.last_sign_in_at,
    'raw_user_meta_data', au.raw_user_meta_data,
    'provider',           coalesce(au.raw_app_meta_data->>'provider', 'discord')
  ) into auth_data
  from auth.users au where au.id = p_user_id;

  -- Comissão atual da fazenda
  select coalesce((value)::numeric, 0.25) into comm_pct
  from settings where key = 'commission_pct';

  -- Stats agregadas em uma única CTE
  with my_claims as (
    select c.id, c.status,
           (select coalesce(sum(ci.quantidade * oi.preco_unit), 0)
              from claim_items ci
              join order_items oi on oi.id = ci.order_item_id
             where ci.claim_id = c.id) as bruto,
           (select coalesce(sum(ci.quantidade), 0)
              from claim_items ci
             where ci.claim_id = c.id) as unidades
    from claims c
    where c.trabalhador_id = p_user_id
  )
  select jsonb_build_object(
    'claims_total',         count(*),
    'claims_pago',          count(*) filter (where status = 'pago'),
    'claims_em_producao',   count(*) filter (where status = 'em_producao'),
    'claims_entregue',      count(*) filter (where status = 'entregue'),
    'claims_cancelado',     count(*) filter (where status = 'cancelado'),
    'bruto_total_pago',     coalesce(sum(bruto)     filter (where status = 'pago'), 0),
    'liquido_total_pago',   coalesce(sum(bruto)     filter (where status = 'pago'), 0) * (1 - comm_pct),
    'comissao_total_pago',  coalesce(sum(bruto)     filter (where status = 'pago'), 0) * comm_pct,
    'unidades_total_pago',  coalesce(sum(unidades)  filter (where status = 'pago'), 0),
    'unidades_total_ativas',coalesce(sum(unidades)  filter (where status in ('em_producao','entregue','pago')), 0),
    'orders_criados',       (select count(*) from orders where criado_por = p_user_id),
    'orders_aprovados',     (select count(*) from orders where aprovado_por = p_user_id)
  ) into stats
  from my_claims;

  return jsonb_build_object(
    'profile', profile_data,
    'auth',    auth_data,
    'stats',   stats
  );
end $$;

grant execute on function get_user_admin_details(uuid) to authenticated;

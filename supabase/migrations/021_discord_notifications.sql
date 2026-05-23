-- 021_discord_notifications.sql
-- Notificações automáticas via webhook Discord usando pg_net.
-- Dispara embeds ricos em 6 eventos: pedido aprovado/cancelado/concluído
-- e claim assumido/entregue/pago.

-- Garante extensão (pré-instalada no Supabase)
create extension if not exists pg_net with schema extensions;

-- ===== Setting padrão =====
insert into settings (key, value)
values ('discord_webhooks', jsonb_build_object(
  'pedidos',    '',
  'producao',   '',
  'financeiro', ''
))
on conflict (key) do nothing;

-- ===== RLS: webhook URLs só visíveis pro proprietário =====
-- Trabalhador/gerente não vê os URLs (evita abuse).
drop policy if exists settings_select on settings;
create policy settings_select on settings for select to authenticated
using (key <> 'discord_webhooks' or app_role() = 'proprietario');

-- ===== Helper: pega URL do webhook =====
create or replace function get_discord_webhook(canal text)
returns text language sql security definer set search_path = public as $$
  select coalesce(value->>canal, '')
  from settings
  where key = 'discord_webhooks';
$$;

-- ===== Helper: envia embed pro Discord (fire-and-forget) =====
create or replace function notify_discord(canal text, embed jsonb)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare
  url text;
begin
  url := get_discord_webhook(canal);
  if url is null or url = '' then return; end if;

  begin
    perform net.http_post(
      url := url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('embeds', jsonb_build_array(embed))
    );
  exception when others then
    -- silencia erros pra não quebrar a transação principal
    null;
  end;
end $$;

-- ===== Trigger: pedido aprovado =====
create or replace function discord_pedido_aprovado()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  total       numeric;
  itens_texto text;
  prazo_texto text;
  link_publico text;
begin
  if NEW.status = 'aprovado' and (OLD.status is null or OLD.status <> 'aprovado') then
    select coalesce(sum(oi.quantidade * oi.preco_unit), 0) into total
    from order_items oi where oi.order_id = NEW.id;

    select string_agg('• **' || oi.quantidade || '×** ' || p.nome, E'\n') into itens_texto
    from order_items oi
    join products p on p.id = oi.product_id
    where oi.order_id = NEW.id;

    prazo_texto := case
      when NEW.prazo_entrega is not null
        then to_char(NEW.prazo_entrega at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24"h"MI')
      else 'a definir'
    end;

    link_publico := 'https://livro-rockefeller.vercel.app/p/' || NEW.public_code;

    perform notify_discord('pedidos', jsonb_build_object(
      'title',       '📜  Novo pedido aberto · Nº ' || NEW.numero_nota,
      'url',         link_publico,
      'description', case
        when NEW.cliente is not null then 'Cliente: **' || NEW.cliente || '**'
        else 'Pedido aprovado e disponível para produção.'
      end,
      'color',  12028749,   -- gold #B78D0D
      'fields', jsonb_build_array(
        jsonb_build_object('name', '💰 Total', 'value', '$' || to_char(total, 'FM999G999D00'), 'inline', true),
        jsonb_build_object('name', '⏰ Prazo', 'value', prazo_texto, 'inline', true),
        jsonb_build_object('name', '📦 Itens', 'value', coalesce(itens_texto, '—'), 'inline', false),
        jsonb_build_object('name', '🔗 Acompanhar', 'value', '[Ver no Caderno →](' || link_publico || ')', 'inline', false)
      ),
      'footer',    jsonb_build_object('text', 'Caderno da Fazenda Rockefeller'),
      'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ));
  end if;
  return NEW;
end $$;

drop trigger if exists discord_orders_aprovado on orders;
create trigger discord_orders_aprovado
after insert or update on orders
for each row execute function discord_pedido_aprovado();

-- ===== Trigger: pedido cancelado =====
create or replace function discord_pedido_cancelado()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if NEW.status = 'cancelado' and OLD.status <> 'cancelado' then
    perform notify_discord('pedidos', jsonb_build_object(
      'title',       '✕  Pedido cancelado · Nº ' || NEW.numero_nota,
      'description', case
        when NEW.cliente is not null then 'Cliente: **' || NEW.cliente || '**'
        else 'Pedido cancelado pelo gerente.'
      end,
      'color',     8659993,    -- burgundy #842419
      'footer',    jsonb_build_object('text', 'Caderno da Fazenda Rockefeller'),
      'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ));
  end if;
  return NEW;
end $$;

drop trigger if exists discord_orders_cancelado on orders;
create trigger discord_orders_cancelado
after update on orders
for each row execute function discord_pedido_cancelado();

-- ===== Trigger: pedido concluído =====
create or replace function discord_pedido_concluido()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if NEW.status = 'concluido' and OLD.status <> 'concluido' then
    perform notify_discord('pedidos', jsonb_build_object(
      'title',       '🏁  Pedido concluído · Nº ' || NEW.numero_nota,
      'description', case
        when NEW.cliente is not null then 'Cliente: **' || NEW.cliente || '**'
        else 'Pedido finalizado.'
      end || E'\nTodos os itens foram entregues e pagos.',
      'color',     5925696,    -- olive #5A6B40
      'footer',    jsonb_build_object('text', 'Caderno da Fazenda Rockefeller'),
      'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ));
  end if;
  return NEW;
end $$;

drop trigger if exists discord_orders_concluido on orders;
create trigger discord_orders_concluido
after update on orders
for each row execute function discord_pedido_concluido();

-- ===== Trigger: claim assumido (insert) =====
create or replace function discord_claim_assumido()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  pedido_num   text;
  cliente_nome text;
  trab_nome    text;
  itens_texto  text;
  saldo_aberto int;
begin
  select o.numero_nota, o.cliente into pedido_num, cliente_nome
  from orders o where o.id = NEW.order_id;

  select coalesce(nullif(pr.nome_completo, ''), pr.discord_handle, 'Trabalhador') into trab_nome
  from profiles pr where pr.id = NEW.trabalhador_id;

  select string_agg('• **' || ci.quantidade || '×** ' || p.nome, E'\n') into itens_texto
  from claim_items ci
  join order_items oi on oi.id = ci.order_item_id
  join products p     on p.id = oi.product_id
  where ci.claim_id = NEW.id;

  select coalesce(sum(quantidade_em_aberto), 0) into saldo_aberto
  from order_item_balance
  where order_id = NEW.order_id;

  perform notify_discord('producao', jsonb_build_object(
    'title',       '🛠  Produção assumida · Nº ' || pedido_num,
    'description', '**' || trab_nome || '** assumiu produção' ||
                   case when cliente_nome is not null then ' do pedido de **' || cliente_nome || '**' else '' end || '.',
    'color',     14195713,   -- amber #D8A741
    'fields',    jsonb_build_array(
      jsonb_build_object('name', '📦 Itens', 'value', coalesce(itens_texto, '—'), 'inline', false),
      jsonb_build_object('name', '⏰ Entrega prevista',
        'value', to_char(NEW.data_prevista_entrega at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24"h"MI'),
        'inline', true),
      jsonb_build_object('name', '📊 Para produzir',
        'value', saldo_aberto::text || ' unidades restantes',
        'inline', true)
    ),
    'footer',    jsonb_build_object('text', 'Caderno da Fazenda Rockefeller'),
    'timestamp', to_char(NEW.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  ));

  return NEW;
end $$;

drop trigger if exists discord_claims_assumido on claims;
create trigger discord_claims_assumido
after insert on claims
for each row execute function discord_claim_assumido();

-- ===== Trigger: claim entregue =====
create or replace function discord_claim_entregue()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  pedido_num text;
  trab_nome  text;
begin
  if NEW.status = 'entregue' and (OLD.status is null or OLD.status <> 'entregue') then
    select o.numero_nota into pedido_num
    from orders o where o.id = NEW.order_id;

    select coalesce(nullif(pr.nome_completo, ''), pr.discord_handle, 'Trabalhador') into trab_nome
    from profiles pr where pr.id = NEW.trabalhador_id;

    perform notify_discord('financeiro', jsonb_build_object(
      'title',       '📦  Entrega no baú · Nº ' || pedido_num,
      'description', '**' || trab_nome || '** marcou a produção como entregue. Aguardando confirmação de pagamento do gerente.',
      'color',     12028749,   -- gold
      'footer',    jsonb_build_object('text', 'Caderno da Fazenda Rockefeller'),
      'timestamp', to_char(coalesce(NEW.entregue_em, now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ));
  end if;
  return NEW;
end $$;

drop trigger if exists discord_claims_entregue on claims;
create trigger discord_claims_entregue
after update on claims
for each row execute function discord_claim_entregue();

-- ===== Trigger: pagamento confirmado =====
create or replace function discord_claim_pago()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  pedido_num   text;
  trab_nome    text;
  bruto        numeric;
  liquido      numeric;
  comissao_pct numeric;
  recibo_link  text;
begin
  if NEW.status = 'pago' and (OLD.status is null or OLD.status <> 'pago') then
    select o.numero_nota into pedido_num
    from orders o where o.id = NEW.order_id;

    select coalesce(nullif(pr.nome_completo, ''), pr.discord_handle, 'Trabalhador') into trab_nome
    from profiles pr where pr.id = NEW.trabalhador_id;

    select coalesce(sum(ci.quantidade * oi.preco_unit), 0) into bruto
    from claim_items ci
    join order_items oi on oi.id = ci.order_item_id
    where ci.claim_id = NEW.id;

    select coalesce((value)::numeric, 0.25) into comissao_pct
    from settings where key = 'commission_pct';

    liquido := bruto * (1 - comissao_pct);

    recibo_link := 'https://livro-rockefeller.vercel.app/r/' || NEW.public_code;

    perform notify_discord('financeiro', jsonb_build_object(
      'title',       '💰  Pagamento confirmado · Nº ' || pedido_num,
      'url',         recibo_link,
      'description', '**' || trab_nome || '** recebeu o pagamento desta produção.',
      'color',     5925696,    -- olive
      'fields',    jsonb_build_array(
        jsonb_build_object('name', '💵 Líquido (trabalhador)', 'value', '$' || to_char(liquido,           'FM999G999D00'), 'inline', true),
        jsonb_build_object('name', '🏛 Comissão (fazenda)',    'value', '$' || to_char(bruto - liquido,   'FM999G999D00'), 'inline', true),
        jsonb_build_object('name', '📊 Bruto total',            'value', '$' || to_char(bruto,             'FM999G999D00'), 'inline', true),
        jsonb_build_object('name', '📜 Recibo',                 'value', '[Ver recibo →](' || recibo_link || ')',           'inline', false)
      ),
      'footer',    jsonb_build_object('text', 'Caderno da Fazenda Rockefeller'),
      'timestamp', to_char(coalesce(NEW.pago_em, now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ));
  end if;
  return NEW;
end $$;

drop trigger if exists discord_claims_pago on claims;
create trigger discord_claims_pago
after update on claims
for each row execute function discord_claim_pago();

-- ===== RPC: teste manual de webhook =====
create or replace function test_discord_webhook(canal text)
returns boolean language plpgsql security definer
set search_path = public as $$
declare
  url text;
begin
  if app_role() <> 'proprietario' then
    raise exception 'Apenas proprietário pode testar webhooks';
  end if;

  url := get_discord_webhook(canal);
  if url is null or url = '' then
    raise exception 'Webhook do canal "%" não configurado', canal;
  end if;

  perform notify_discord(canal, jsonb_build_object(
    'title',       '🌾  Teste · Caderno da Fazenda',
    'description', 'Se você está vendo esta mensagem, o webhook do canal **' || canal || '** está configurado corretamente.',
    'color',     12028749,
    'fields',    jsonb_build_array(
      jsonb_build_object('name', 'Canal', 'value', canal, 'inline', true),
      jsonb_build_object('name', 'Status', 'value', '✓ funcionando', 'inline', true)
    ),
    'footer',    jsonb_build_object('text', 'Caderno da Fazenda Rockefeller · teste manual'),
    'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  ));

  return true;
end $$;

grant execute on function test_discord_webhook(text) to authenticated;

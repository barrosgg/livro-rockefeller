-- 023_discord_better_embeds.sql
-- Reescreve os embeds Discord com:
-- • Textos mais cativantes e CTAs claras
-- • Itens listados, totais formatados corretamente
-- • Soluciona race condition: itens são inseridos APÓS o order/claim,
--   então o trigger não enxergava itens. Solução:
--   - Para PEDIDO aprovado: frontend agora insere como 'rascunho',
--     insere itens, então UPDATE pra 'aprovado' — trigger dispara
--     com itens já presentes (sem mudança de SQL aqui, só no frontend)
--   - Para CLAIM assumido: trigger AFTER INSERT removido; criada RPC
--     notify_claim_assumido(uuid) chamada pelo frontend após inserir
--     todos os claim_items.

-- ========================================================================
-- PEDIDO APROVADO — embed mais cativante com CTA para trabalhadores
-- ========================================================================
create or replace function discord_pedido_aprovado()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  total          numeric;
  total_unidades int;
  itens_texto    text;
  prazo_texto    text;
  link_publico   text;
begin
  if NEW.status = 'aprovado' and (OLD.status is null or OLD.status <> 'aprovado') then
    select coalesce(sum(oi.quantidade * oi.preco_unit), 0),
           coalesce(sum(oi.quantidade), 0)
      into total, total_unidades
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
      'description', E'🌾 **Pedido novo na Fazenda Rockefeller!**\n\n' ||
                     case
                       when NEW.cliente is not null then 'Cliente: **' || NEW.cliente || E'**\n\n'
                       else ''
                     end ||
                     E'🛠 **Trabalhadores:** quem assumir antes garante o trabalho. ' ||
                     E'O pagamento é por unidade produzida — quanto mais você produz, ' ||
                     E'mais recebe. Vários podem dividir a mesma produção e ' ||
                     E'todos saem ganhando.\n\n' ||
                     E'👉 Abra o pedido pelo link abaixo e assuma sua parte agora.',
      'color',     12028749,
      'fields',    jsonb_build_array(
        jsonb_build_object('name', '💰 Valor total',  'value', '$' || to_char(total, 'FM999G999G999D00'),                  'inline', true),
        jsonb_build_object('name', '⏰ Prazo',         'value', prazo_texto,                                                'inline', true),
        jsonb_build_object('name', '📊 Disponível',   'value', coalesce(total_unidades, 0)::text || ' unidades p/ produzir','inline', true),
        jsonb_build_object('name', '📦 Itens',         'value', coalesce(itens_texto, '_— pedido sem itens —_'),           'inline', false),
        jsonb_build_object('name', '🔗 Assumir produção', 'value', '**[Abrir no Livro e assumir →](' || link_publico || ')**', 'inline', false)
      ),
      'footer',    jsonb_build_object('text', 'Livro da Fazenda Rockefeller · pedidos'),
      'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ));
  end if;
  return NEW;
end $$;

-- ========================================================================
-- PEDIDO CANCELADO
-- ========================================================================
create or replace function discord_pedido_cancelado()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if NEW.status = 'cancelado' and OLD.status <> 'cancelado' then
    perform notify_discord('pedidos', jsonb_build_object(
      'title',       '✕  Pedido cancelado · Nº ' || NEW.numero_nota,
      'description', case
                       when NEW.cliente is not null then 'Cliente: **' || NEW.cliente || E'**\n\n'
                       else ''
                     end ||
                     E'❌ Este pedido foi **cancelado pelo gerente**.\n\n' ||
                     E'⚠ **Trabalhadores que haviam assumido produção:** ' ||
                     E'a produção foi anulada — vocês não precisam mais entregar ' ||
                     E'esses itens. Procurem o gerente caso ja tenham entregue alguma parte.',
      'color',     8659993,
      'footer',    jsonb_build_object('text', 'Livro da Fazenda Rockefeller · pedidos'),
      'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ));
  end if;
  return NEW;
end $$;

-- ========================================================================
-- PEDIDO CONCLUÍDO
-- ========================================================================
create or replace function discord_pedido_concluido()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  link_publico text;
  total        numeric;
begin
  if NEW.status = 'concluido' and OLD.status <> 'concluido' then
    link_publico := 'https://livro-rockefeller.vercel.app/p/' || NEW.public_code;

    select coalesce(sum(oi.quantidade * oi.preco_unit), 0) into total
      from order_items oi where oi.order_id = NEW.id;

    perform notify_discord('pedidos', jsonb_build_object(
      'title',       '🏁  Pedido concluído · Nº ' || NEW.numero_nota,
      'url',         link_publico,
      'description', case
                       when NEW.cliente is not null then 'Cliente: **' || NEW.cliente || E'**\n\n'
                       else ''
                     end ||
                     E'🎉 **Pedido finalizado com sucesso!**\n\n' ||
                     E'Todos os itens foram entregues e os pagamentos confirmados. ' ||
                     E'Obrigado aos trabalhadores que participaram desta produção — ' ||
                     E'a Família Rockefeller agradece. 🌾',
      'color',     5925696,
      'fields',    jsonb_build_array(
        jsonb_build_object('name', '💰 Valor final do pedido', 'value', '$' || to_char(total, 'FM999G999G999D00'), 'inline', true)
      ),
      'footer',    jsonb_build_object('text', 'Livro da Fazenda Rockefeller · pedidos'),
      'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ));
  end if;
  return NEW;
end $$;

-- ========================================================================
-- CLAIM ASSUMIDO — agora via RPC (chamada pelo frontend após items inseridos)
-- Trigger AFTER INSERT removido porque disparava ANTES dos claim_items
-- existirem, resultando em embed com itens em branco.
-- ========================================================================
drop trigger if exists discord_claims_assumido on claims;

create or replace function notify_claim_assumido(p_claim_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_claim       claims;
  pedido_num    text;
  pedido_pcode  text;
  cliente_nome  text;
  trab_nome     text;
  itens_texto   text;
  total_itens   int;
  saldo_aberto  int;
  link_publico  text;
begin
  select * into v_claim from claims where id = p_claim_id;
  if not found then raise exception 'Claim não encontrado'; end if;

  -- Só o trabalhador dono ou gerente/proprietário podem chamar
  if v_claim.trabalhador_id <> auth.uid() and app_role() not in ('gerente', 'proprietario') then
    raise exception 'sem permissão para notificar este claim';
  end if;

  select o.numero_nota, o.cliente, o.public_code
    into pedido_num, cliente_nome, pedido_pcode
    from orders o where o.id = v_claim.order_id;
  link_publico := 'https://livro-rockefeller.vercel.app/p/' || pedido_pcode;

  select coalesce(nullif(pr.nome_completo, ''), pr.discord_handle, 'Trabalhador')
    into trab_nome
    from profiles pr where pr.id = v_claim.trabalhador_id;

  select string_agg('• **' || ci.quantidade || '×** ' || p.nome, E'\n'),
         coalesce(sum(ci.quantidade), 0)
    into itens_texto, total_itens
    from claim_items ci
    join order_items oi on oi.id = ci.order_item_id
    join products p     on p.id = oi.product_id
   where ci.claim_id = v_claim.id;

  select coalesce(sum(quantidade_em_aberto), 0) into saldo_aberto
    from order_item_balance
   where order_id = v_claim.order_id;

  perform notify_discord('producao', jsonb_build_object(
    'title',       '🛠  Produção assumida · Nº ' || pedido_num,
    'url',         link_publico,
    'description', '**' || trab_nome || '** acaba de assumir parte da produção' ||
                   case when cliente_nome is not null then ' do pedido de **' || cliente_nome || '**' else '' end || '.' ||
                   case
                     when saldo_aberto > 0 then
                       E'\n\n🔓 **Ainda restam ' || saldo_aberto::text ||
                       ' unidades** para outros trabalhadores assumirem! ' ||
                       'Quanto mais gente produz junto, mais rápido entregamos e todos recebem.'
                     else
                       E'\n\n✓ **Toda a produção foi assumida!** Aguardando entregas no baú.'
                   end,
    'color',     14195713,
    'fields',    jsonb_build_array(
      jsonb_build_object('name', '📦 Itens assumidos', 'value', coalesce(itens_texto, '—'),                              'inline', false),
      jsonb_build_object('name', '⚖ Total',           'value', coalesce(total_itens, 0)::text || ' unidades',           'inline', true),
      jsonb_build_object('name', '⏰ Entrega prevista',
        'value', to_char(v_claim.data_prevista_entrega at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24"h"MI'),
        'inline', true),
      jsonb_build_object('name', '📊 Saldo do pedido',
        'value', case when saldo_aberto > 0 then saldo_aberto::text || ' unid. p/ assumir' else '✓ tudo coberto' end,
        'inline', true)
    ),
    'footer',    jsonb_build_object('text', 'Livro da Fazenda Rockefeller · produção'),
    'timestamp', to_char(v_claim.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  ));
end $$;

grant execute on function notify_claim_assumido(uuid) to authenticated;

-- ========================================================================
-- CLAIM ENTREGUE — mais info + CTA pro gerente
-- ========================================================================
create or replace function discord_claim_entregue()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  pedido_num    text;
  trab_nome     text;
  cliente_nome  text;
  itens_texto   text;
  bruto         numeric;
begin
  if NEW.status = 'entregue' and (OLD.status is null or OLD.status <> 'entregue') then
    select o.numero_nota, o.cliente into pedido_num, cliente_nome
      from orders o where o.id = NEW.order_id;

    select coalesce(nullif(pr.nome_completo, ''), pr.discord_handle, 'Trabalhador') into trab_nome
      from profiles pr where pr.id = NEW.trabalhador_id;

    select string_agg('• **' || ci.quantidade || '×** ' || p.nome, E'\n'),
           coalesce(sum(ci.quantidade * oi.preco_unit), 0)
      into itens_texto, bruto
      from claim_items ci
      join order_items oi on oi.id = ci.order_item_id
      join products p     on p.id = oi.product_id
     where ci.claim_id = NEW.id;

    perform notify_discord('financeiro', jsonb_build_object(
      'title',       '📦  Entrega no baú · Nº ' || pedido_num,
      'description', '**' || trab_nome || '** marcou esta produção como **entregue no baú**.' ||
                     case when cliente_nome is not null then E'\n\nCliente: **' || cliente_nome || '**' else '' end ||
                     E'\n\n💰 **Gerente:** confira o baú e confirme o pagamento ' ||
                     'para o trabalhador receber sua remuneração. O recibo oficial ' ||
                     'será gerado automaticamente após a confirmação.',
      'color',     12028749,
      'fields',    jsonb_build_array(
        jsonb_build_object('name', '📦 Itens entregues',  'value', coalesce(itens_texto, '—'),                          'inline', false),
        jsonb_build_object('name', '💵 Valor bruto',      'value', '$' || to_char(bruto, 'FM999G999G999D00'),         'inline', true),
        jsonb_build_object('name', '⏳ Status',           'value', 'Aguardando confirmação do gerente',                'inline', true)
      ),
      'footer',    jsonb_build_object('text', 'Livro da Fazenda Rockefeller · financeiro'),
      'timestamp', to_char(coalesce(NEW.entregue_em, now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ));
  end if;
  return NEW;
end $$;

-- ========================================================================
-- PAGAMENTO CONFIRMADO — com itens, valor e link do recibo
-- ========================================================================
create or replace function discord_claim_pago()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  pedido_num   text;
  trab_nome    text;
  cliente_nome text;
  bruto        numeric;
  liquido      numeric;
  comissao_pct numeric;
  recibo_link  text;
  itens_texto  text;
  total_itens  int;
begin
  if NEW.status = 'pago' and (OLD.status is null or OLD.status <> 'pago') then
    select o.numero_nota, o.cliente into pedido_num, cliente_nome
      from orders o where o.id = NEW.order_id;

    select coalesce(nullif(pr.nome_completo, ''), pr.discord_handle, 'Trabalhador') into trab_nome
      from profiles pr where pr.id = NEW.trabalhador_id;

    select string_agg('• **' || ci.quantidade || '×** ' || p.nome, E'\n'),
           coalesce(sum(ci.quantidade * oi.preco_unit), 0),
           coalesce(sum(ci.quantidade), 0)
      into itens_texto, bruto, total_itens
      from claim_items ci
      join order_items oi on oi.id = ci.order_item_id
      join products p     on p.id = oi.product_id
     where ci.claim_id = NEW.id;

    select coalesce((value)::numeric, 0.25) into comissao_pct
      from settings where key = 'commission_pct';

    liquido := bruto * (1 - comissao_pct);
    recibo_link := 'https://livro-rockefeller.vercel.app/r/' || NEW.public_code;

    perform notify_discord('financeiro', jsonb_build_object(
      'title',       '💰  Pagamento confirmado · Nº ' || pedido_num,
      'url',         recibo_link,
      'description', '🎉 **' || trab_nome || '** recebeu o pagamento por esta produção!' ||
                     case when cliente_nome is not null then E'\n\nCliente: **' || cliente_nome || '**' else '' end ||
                     E'\n\nO recibo oficial está disponível para o trabalhador ' ||
                     'e pode ser baixado em PNG para registros pessoais.',
      'color',     5925696,
      'fields',    jsonb_build_array(
        jsonb_build_object('name', '💵 Líquido (trabalhador)', 'value', '**$' || to_char(liquido,         'FM999G999G999D00') || '**', 'inline', true),
        jsonb_build_object('name', '🏛 Comissão (fazenda)',    'value', '$' || to_char(bruto - liquido,   'FM999G999G999D00'),         'inline', true),
        jsonb_build_object('name', '📊 Bruto total',            'value', '$' || to_char(bruto,             'FM999G999G999D00'),         'inline', true),
        jsonb_build_object('name', '📦 Produção paga',          'value', coalesce(itens_texto, '—'),                                       'inline', false),
        jsonb_build_object('name', '⚖ Total entregue',         'value', coalesce(total_itens, 0)::text || ' unidades',                  'inline', true),
        jsonb_build_object('name', '📜 Recibo oficial',         'value', '**[Ver recibo →](' || recibo_link || ')**',                    'inline', true)
      ),
      'footer',    jsonb_build_object('text', 'Livro da Fazenda Rockefeller · financeiro'),
      'timestamp', to_char(coalesce(NEW.pago_em, now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ));
  end if;
  return NEW;
end $$;

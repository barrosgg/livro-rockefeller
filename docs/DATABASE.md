# Banco de Dados

Referência completa do schema Postgres no Supabase. Todas as alterações ficam em `supabase/migrations/NNN_*.sql` (numeradas em ordem). O schema inicial está em `supabase/schema.sql`.

## Tabelas

### `profiles`
Dados 1:1 com `auth.users`. Criado automaticamente via trigger no signup.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | = `auth.uid()` |
| `nome_completo` | text NOT NULL | |
| `identificacao` | text NOT NULL | RG/passaporte do personagem |
| `discord_handle` | text NOT NULL | |
| `conta_bancaria` | text NOT NULL | |
| `correio` | text | PO Box opcional (migration 011) |
| `role` | user_role | `proprietario`/`gerente`/`trabalhador` (default) |
| `avatar` | text | URL ou slug (migration 007) |
| `disabled` | bool NOT NULL DEFAULT false | (migration 005) |
| `public_code` | text UNIQUE NOT NULL | 10 chars para link público (migration 013) |
| `contrato_assinado_em` | timestamptz | (migration 014) |
| `badges_extras` | text[] | IDs de conquistas manuais (migration 017) |
| `onboarding_completed_em` | timestamptz | (migration 019) |
| `criado_em` | timestamptz NOT NULL | |

### `products`
Catálogo. 61 produtos seedados, ampliáveis pelo Admin.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | serial PK | |
| `nome` | text UNIQUE NOT NULL | |
| `categoria` | text NOT NULL | uma das `settings.categorias` |
| `preco_min`, `preco_max` | numeric(10,2) NOT NULL | faixa permitida |
| `icon` | text | slug `autor/icon` (migration 009) |

### `orders`
Pedido feito por um Gerente.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `short_code` | text UNIQUE NOT NULL | 6 chars (migration 003) |
| `public_code` | text UNIQUE NOT NULL | 10 chars (migration 003) |
| `numero_nota` | text NOT NULL | 4 dígitos visual |
| `cliente` | text | nome do cliente |
| `anotacoes` | text | |
| `notas_internas` | text | só gerente vê (migration 006) |
| `desconto_pct` | numeric(5,2) NOT NULL DEFAULT 0 | capado pela margem |
| `status` | order_status | `rascunho`/`aprovado`/`em_producao`/`entregue`/`pago`/`concluido`/`cancelado` |
| `prazo_entrega` | timestamptz | obrigatório ao aprovar |
| `criado_por` | uuid FK profiles | |
| `aprovado_por`, `aprovado_em` | uuid/timestamptz | |
| `concluido_em` | timestamptz | |
| `criado_em` | timestamptz NOT NULL | |

### `order_items`
Itens do pedido. Cascade delete com `orders`.

| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `order_id` | uuid FK orders CASCADE |
| `product_id` | int FK products |
| `quantidade` | int NOT NULL >0 |
| `preco_unit` | numeric(10,2) NOT NULL |

### `claims`
Produção assumida por um trabalhador.

| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `order_id` | uuid FK orders CASCADE |
| `trabalhador_id` | uuid FK profiles |
| `data_prevista_entrega` | timestamptz NOT NULL |
| `status` | claim_status (`em_producao`/`entregue`/`pago`/`cancelado`) |
| `entregue_em`, `pago_em` | timestamptz |
| `pago_por` | uuid FK profiles |
| `public_code` | text UNIQUE NOT NULL | 10 chars para recibo (migration 016) |
| `criado_em` | timestamptz NOT NULL |

### `claim_items`
Itens incluídos em um claim. Cascade com claims e order_items.

| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `claim_id` | uuid FK claims CASCADE |
| `order_item_id` | uuid FK order_items CASCADE |
| `quantidade` | int NOT NULL >0 |

### `settings`
Configuração global (key/value JSON). Editada por Proprietário no Admin.

| Coluna | Tipo |
|---|---|
| `key` | text PK |
| `value` | jsonb NOT NULL |
| `updated_at` | timestamptz |
| `updated_by` | uuid FK profiles |

Keys padrão:
- `commission_pct` = `0.25` (25% retidos pela Fazenda)
- `farm_name` = `"Fazenda Rockefeller"`
- `categorias` = `[…]` (array de strings)

### `audit_log`
Eventos automáticos disparados por triggers em `orders`, `claims`, `profiles`.

| Coluna | Tipo |
|---|---|
| `id` | bigserial PK |
| `actor_id` | uuid FK profiles | quem executou |
| `action` | text | ex: `order.status_aprovado`, `claim.status_pago` |
| `entity_type` | text | `order`/`claim`/`profile` |
| `entity_id` | text | id da entidade |
| `payload` | jsonb | snapshot relevante |
| `criado_em` | timestamptz |

### `order_templates`, `order_template_items`
Templates de pedido salvos para reutilização (migration 006).

## View: `order_item_balance`

Calcula em tempo real, por order_item:
- `quantidade_total` (do pedido)
- `quantidade_assumida` (soma dos claims ativos)
- `quantidade_em_aberto` (diferença, usada na UI)

Claims ativos = status `em_producao`, `entregue` ou `pago`.

## Enums

```sql
user_role:   'proprietario' | 'gerente' | 'trabalhador'
order_status: 'rascunho' | 'aprovado' | 'em_producao' | 'entregue'
              | 'pago' | 'concluido' | 'cancelado'
claim_status: 'em_producao' | 'entregue' | 'pago' | 'cancelado'
```

## RLS (Row Level Security)

Habilitada em **todas as tabelas**. Política geral:

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | autenticado | trigger no signup | dono OU proprietario | – |
| `products` | autenticado | gerente/proprietario | gerente/proprietario | gerente/proprietario |
| `orders` | autenticado | gerente/proprietario | gerente/proprietario | – |
| `order_items` | autenticado | gerente/proprietario | gerente/proprietario | – |
| `claims` | autenticado | self + contrato assinado (mig 015) | self enquanto `em_producao` OU gerente | – |
| `claim_items` | autenticado | dono do claim ou gerente | dono ou gerente | – |
| `settings` | autenticado | proprietario | proprietario | proprietario |
| `audit_log` | gerente/proprietario | trigger via SECURITY DEFINER | – | – |
| `order_templates` | autenticado | gerente/proprietario | gerente/proprietario | gerente/proprietario |

Helper: `app_role()` SECURITY DEFINER retorna o role do usuário atual.

### Por que `app_role` e não `current_role`?

`current_role` é função reservada do Postgres — não dá pra sobrescrever. Erro comum durante setup inicial.

## Triggers

- `on_auth_user_created` → cria `profiles` ao registrar usuário no Auth
- `prevent_role_self_change` → impede usuário comum de mudar próprio role ou disabled
- `audit_orders` / `audit_claims` / `audit_profiles` → loga em `audit_log` mudanças relevantes (status, role, disabled)

## RPCs (Remote Procedure Calls)

Funções públicas chamáveis via `supabase.rpc()`. Usam `SECURITY DEFINER` para bypass de RLS quando necessário (acesso anônimo seguro).

### `get_order_public(p_code text)` → jsonb
Retorna pedido + itens + claims (sem expor identificação/conta dos trabalhadores). Aceita lookup por `public_code` (10c), `short_code` (6c) ou `id` (UUID).

### `get_profile_public(p_code text)` → jsonb
Retorna credencial pública (sem email/auth, com badges_extras). Bloqueia perfis `disabled`.

### `get_recibo_public(p_code text)` → jsonb
Retorna recibo só se claim está `pago`. Inclui itens, totais, dados do trabalhador.

### `gen_alpha_code(len int)` → text
Gera código alfanumérico legível (sem 0/O/1/I/L). Usado como DEFAULT em `short_code`, `public_code`.

### `log_event(action, entity_type, entity_id, payload)` → void
Helper chamado pelos triggers de auditoria. SECURITY DEFINER.

### `app_role()` → user_role
Retorna o role do usuário autenticado. SECURITY DEFINER.

## Migrations

Ordem cronológica em `supabase/migrations/`:

| # | Conteúdo |
|---|---|
| `schema.sql` | Setup inicial: tabelas, enums, RLS, seed de 61 produtos |
| `002_public_link.sql` | (obsoleto — usava `public_token` UUID) |
| `003_short_codes.sql` | `short_code` (6c) e `public_code` (10c) em orders |
| `004_fix_cascade.sql` | CASCADE em claim_items → order_items |
| `005_admin_settings.sql` | `settings` table + `profiles.disabled` |
| `006_advanced_admin.sql` | audit_log + templates + notas_internas + categorias seed |
| `007_avatar.sql` | `profiles.avatar` |
| `008_public_avatar.sql` | (obsoleto — incluído depois em outros) |
| `009_product_icons.sql` | `products.icon` + mapeamento inicial |
| `010_public_icon.sql` | Inclui icon no RPC público de pedido |
| `011_profile_correio.sql` | `profiles.correio` (PO Box) |
| `012_fix_icon_slugs.sql` | Correção dos slugs (alguns 404 no game-icons.net) |
| `013_profile_public_code.sql` | `profiles.public_code` + RPC `get_profile_public` |
| `014_contrato.sql` | `profiles.contrato_assinado_em` |
| `015_claim_requires_contract.sql` | RLS exige contrato assinado para INSERT em claims |
| `016_recibos.sql` | `claims.public_code` + RPC `get_recibo_public` |
| `017_badges_extras.sql` | `profiles.badges_extras` + grant inicial barrosgg |
| `018_fix_rpc_no_public_token.sql` | Remove referência a `public_token` inexistente |
| `019_onboarding.sql` | `profiles.onboarding_completed_em` |
| `020_public_badges.sql` | Inclui badges_extras no RPC público de perfil |

## Como rodar migrations

1. **Setup zero**: cole `supabase/schema.sql` inteiro no SQL Editor → Run
2. **Atualizações**: cole o conteúdo da migration nova → Run
3. Migrations são **idempotentes** (usam `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, etc) — rodar 2x não quebra

## Backup

Admin → **Backup** baixa CSV de pedidos, claims, profiles e produtos. Útil para snapshots manuais. Auditoria do Supabase Dashboard cobre backup automático (free tier: 7 dias).

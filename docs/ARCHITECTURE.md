# Arquitetura

## Visão geral

```
┌─────────────────────────────────────────────────────────────┐
│  Navegador do usuário (Vercel CDN serve estático)          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  React 18 + Vite + React Router 6                  │    │
│  │  - AuthProvider (sessão Supabase)                  │    │
│  │  - SettingsProvider (comissão, categorias, etc)    │    │
│  │  - UIProvider (toasts + confirmDialogs)            │    │
│  │  - ErrorBoundary                                    │    │
│  └─────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
                         │ - PostgREST API (CRUD)
                         │ - RPC functions (RPC)
                         │ - Auth (OAuth Discord)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase Cloud                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Postgres 15                                        │    │
│  │  - Tabelas: orders, claims, products, profiles,     │    │
│  │    settings, audit_log, order_templates             │    │
│  │  - Views: order_item_balance                        │    │
│  │  - RPCs: get_order_public, get_profile_public,      │    │
│  │    get_recibo_public                                 │    │
│  │  - RLS: por role (proprietario/gerente/trabalhador) │    │
│  │  - Triggers: audit_log, contrato gate, etc.         │    │
│  │  - Auth: provider Discord OAuth                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Personas e papéis (roles)

Cada usuário tem um único role armazenado em `profiles.role`:

| Role | Pode |
|---|---|
| **proprietario** | Tudo. Admin do sistema. Edita roles, comissão, produtos, categorias. |
| **gerente** | Cria/aprova/cancela pedidos. Confirma pagamentos. Edita produtos. |
| **trabalhador** | Assume produção em pedidos abertos. Marca entregas. Recebe recibo. |

Trocas de role são restritas: apenas Proprietário muda role de qualquer um. Tentativa de auto-promoção é bloqueada por trigger Postgres (`prevent_role_self_change`).

## Ciclo de vida de um pedido

```
[Gerente]                     [Trabalhador]                [Gerente]
   │                              │                          │
   ▼                              │                          │
┌──────────┐  aprovar           │                          │
│ rascunho │ ──────────────┐    │                          │
└──────────┘               │    │                          │
                           ▼    │                          │
                      ┌──────────┐  assume claim          │
                      │ aprovado │ ──────────────┐         │
                      └──────────┘               │         │
                                                  ▼         │
                                       ┌──────────────┐    │
                                       │ em_producao  │    │
                                       └──────────────┘    │
                                              │            │
                                              │ trabalhador│
                                              │ entrega    │
                                              ▼            │
                                       ┌──────────┐        │
                                       │ entregue │ ──────►│ confirma pagamento
                                       └──────────┘        │
                                                           ▼
                                                    ┌──────────┐
                                                    │   pago   │
                                                    └──────────┘
                                                           │
                                                           │ (todos itens
                                                           │  pagos e
                                                           │  saldo zero)
                                                           ▼
                                                    ┌────────────┐
                                                    │ concluido  │
                                                    └────────────┘

                                       Em qualquer ponto:
                                       ┌────────────┐
                                       │ cancelado  │ (Gerente)
                                       └────────────┘
```

Cada **claim** (produção assumida) tem seu próprio ciclo: `em_producao → entregue → pago`. O **pedido** só vira `concluido` quando todos os itens foram pagos e o saldo em aberto chega a zero.

### Como o saldo em aberto funciona

`order_item_balance` é uma **view** que calcula em tempo real:

```
quantidade_em_aberto = quantidade_total
                       - soma(quantidade dos claims ativos do mesmo item)

claims ativos = status IN ('em_producao', 'entregue', 'pago')
```

Trabalhadores só conseguem assumir até o saldo restante. Vários trabalhadores podem dividir a produção de um mesmo item.

## Remuneração

Definida em `lib/calc.js` e ajustável em runtime via `settings.commission_pct`:

```
bruto    = qtd × preço_unit (somatório por claim)
comissao = bruto × commission_pct      (padrão 25%, vai para a Fazenda)
liquido  = bruto × (1 - commission_pct) (75%, vai para o trabalhador)
```

Preço de cada item fica entre `preco_min` e `preco_max` (clamp no frontend e validado no banco). Preço default ao adicionar item = `preco_max` (margem máxima para descontos).

## Contrato de prestação de serviços

Antes de assumir qualquer claim, o trabalhador deve **assinar eletronicamente** o contrato em `/perfil > aba Contrato`. A assinatura grava `profiles.contrato_assinado_em` (timestamptz).

Camada dupla de bloqueio:
1. **Frontend**: `PedidoDetalhe` não mostra o formulário de claim se `!profile.contrato_assinado_em`
2. **RLS Postgres**: política `claims_insert_self` exige `profiles.contrato_assinado_em IS NOT NULL`

## Links públicos (compartilháveis)

Três tipos de URL pública (sem login):

| Rota | RPC | O que retorna |
|---|---|---|
| `/p/<public_code>` | `get_order_public` | Acompanhamento do pedido (cliente) |
| `/c/<public_code>` | `get_profile_public` | Credencial pública do trabalhador |
| `/r/<public_code>` | `get_recibo_public` | Recibo de produção paga |

`public_code` é alfanumérico de 10 chars (sem 0/O/1/I/L para legibilidade). Gerado por `gen_alpha_code(10)` no Postgres. Coliões praticamente impossíveis (~3.5×10¹⁴ combinações).

URLs internas usam `short_code` de 6 chars (mais curto, exigem login).

## Onboarding e ajuda

- **Modal de boas-vindas** (`<Onboarding />`) aparece automaticamente quando o profile está completo e `onboarding_completed_em IS NULL`. 4 slides: boas-vindas → fluxo → role → próximos passos.
- **Página `/ajuda`** documenta o funcionamento de forma persistente, com tabelas de papéis, regras e atalhos de teclado.

## Acessibilidade (a11y)

Implementado em camadas:
- **Skip link** no início do body
- **Foco gerenciado**: ScrollToTop foca `<main>` ao mudar de rota; modais (Onboarding, ConfirmDialog) têm focus trap via `lib/a11y.js`
- **ARIA**: aria-label em botões de emoji, aria-current automático em NavLinks, aria-live em loading states, aria-sort em tabelas ordenáveis
- **Contraste WCAG AA**: todas as variáveis CSS de tinta (`--ink*`) verificadas
- **Touch targets**: mínimo 38px (32px em variantes `.sm`)
- **Tabelas responsivas**: viram cards em mobile com `data-label`

## Decisões de design

| Decisão | Por quê |
|---|---|
| Vite em vez de Next.js | App é estática (sem SSR/SSO necessário). Vite é mais rápido e Vercel serve trivialmente. |
| Sem TypeScript | Equipe é pequena, app não tem APIs públicas. Velocidade > type safety neste estágio. |
| Sem framework CSS (Tailwind, etc.) | Tema vintage muito específico, classes utility ficariam verbosas. CSS puro com variáveis cobre. |
| Supabase em vez de backend próprio | Auth + Postgres + RLS + RPC em 1 hora de setup. Free tier farto pro caso de uso. |
| RLS no Postgres (não no front) | Política de segurança vive próxima do dado. Não dá pra burlar pela API. |
| `public_code` curto (10 chars) | UX melhor que UUID 36 chars em links no Discord. Entropia suficiente. |
| RPCs para acesso público | Permite controle granular do que vaza pro anônimo (sem expor `auth.uid()`). |
| `badges_extras` text[] | Conquistas manuais simples sem nova tabela. Auto-ganhos calculados no frontend a partir de stats. |
| Logo PNG, não SVG | Logo é arte raster da Família, não vai escalar muito além do ~250px máximo usado. |
| Ícones SVG locais (não CDN) | Performance + offline + sem hotlinking de assets de terceiros. |

## Próximas evoluções (resumo, ver ROADMAP)

- Notificações Discord webhook em eventos críticos
- Bot Discord para criar pedidos
- Dashboard de gerente com gráficos
- Multi-fazenda (multi-tenant)
- Templates de pedido com schedules recorrentes
- Auditoria com filtros avançados e export

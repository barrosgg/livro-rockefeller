# Roadmap

Histórico do que foi entregue + ideias futuras. Sem datas (projeto de RP, ritmo orgânico).

## ✓ Entregues

### v0 — MVP (semana 1)
- Auth Discord OAuth via Supabase
- CRUD de pedidos, items e claims
- Roles (proprietario / gerente / trabalhador)
- RLS Postgres por role
- Cálculo de bruto / comissão / líquido em runtime
- Layout vintage 1900 (Playfair Display + Lora)
- Tabela `order_item_balance` para saldo em aberto

### v1 — Polimento (semana 2)
- `short_code` (6c) e `public_code` (10c) para URLs amigáveis
- Link público `/p/<code>` para acompanhamento do cliente
- RPC `get_order_public` com filtro de dados sensíveis
- Cascade delete em claim_items
- Avatares por slug (catálogo curado)
- Ícones de produto (game-icons.net)
- Tabelas responsivas viram cards em mobile

### v2 — Admin avançado (semana 3)
- 9 abas no Admin: Dashboard, Produtos, Usuários, Categorias, Configurações, Templates, Auditoria, Backup, Sobre
- `settings` table (commission_pct, farm_name, categorias) editável em runtime
- Templates de pedido para reutilização
- Auditoria automática via triggers em `audit_log`
- Notas internas em pedidos (gerente-only)
- Backup CSV de pedidos/claims/profiles/produtos

### v3 — Trabalhador (semana 4)
- Página `MeusTrabalhos` com histórico e ganhos
- Contrato de prestação de serviços com assinatura eletrônica
- Gate dupla camada: frontend + RLS exigem `contrato_assinado_em` antes de claim
- Credencial pública `/c/<code>` com carteira oficial (frente + verso)
- Recibo público `/r/<code>` para claims pagos
- Download PNG via html2canvas em credencial e recibo
- Sistema de conquistas/badges (auto-ganhos + manuais via `badges_extras`)
- Medalhas com símbolos unicode + cores por tier (gold/silver/bronze)

### v4 — UX e onboarding (semana 5)
- Modal `Onboarding` com 4 slides ao primeiro login completo
- Página `/ajuda` com tabelas de papéis, fluxo e atalhos
- `StatusTimeline` em pedidos (linha do tempo horizontal)
- Toasts e diálogos de confirmação imperativos (`useUI`)
- `ErrorBoundary` global
- `ScrollToTop` + foco em `<main>` ao mudar rota
- Skip link + focus trap em modais
- Aria-* completos (live, sort, current, label)
- Footer carta timbrada vintage com logo SVG

### v5 — Visual de login (semana 6)
- Background fazenda com foto real
- Frosted glass + vinheta + poeira dourada + névoa
- Card alinhado à esquerda em desktop
- Animações de entrada (fadeUp, zoomIn, stamp)
- Glow dourado vazando do card para a imagem

## ⊙ Em consideração (próximas)

### Bot Discord
- Comando `/pedido novo cliente:"Fulano" ...` para Gerente criar pedido sem abrir o app
- Notificação no canal #fazenda quando claim assumido / entregue / pago
- DM ao trabalhador quando pagamento confirmado

### Dashboard de gerente
- Gráficos de pedidos por status / mês
- Top 5 trabalhadores por unidades / valor
- Tempo médio até entrega
- Pedidos atrasados (prazo passou)

### Schedules recorrentes
- Templates com cadência ("toda segunda criar pedido X de café")
- Cron via Supabase Edge Function ou GitHub Action

### Notificações Discord webhook
- Disparar webhook em eventos críticos (pedido aprovado, pagamento confirmado, contrato assinado)
- Configurável por evento na aba Admin

### Multi-fazenda (multi-tenant)
- Suporte a múltiplas famílias usando o mesmo app
- Coluna `farm_id` em tudo + RLS filtrando pela fazenda do user
- Branding configurável (logo, cores, nome)

### Auditoria avançada
- Filtros por actor, action, entity, período
- Export CSV / JSON
- Replay (reverter ação)

### Histórico de preços
- Tracking de mudanças de `preco_min`/`preco_max` em produtos
- Gráfico de evolução

## ✗ Decidido **não** fazer

| Ideia | Por quê |
|---|---|
| TypeScript | Equipe pequena, sem APIs públicas. Velocidade > type safety neste estágio |
| Tailwind | Tema vintage muito específico, utility classes ficariam verbosas |
| Backend próprio (Node/Express) | Supabase resolve auth + DB + RLS sem manutenção |
| SSR (Next.js) | App é stateful pós-login. Conteúdo público dá tráfego baixo, não vale o custo |
| Service Worker / PWA | Caso de uso é desktop (Discord + Vercel). Mobile-friendly basta |
| Real-time updates (Supabase Realtime) | Tráfego baixo, refresh manual é suficiente |
| Internacionalização | App é PT-BR-only no contexto de RP BR |
| Pagamentos reais (Stripe etc) | É RP — "pagamento" é só fictício/in-game |

## Princípios

- **Simplicidade > completude**. Toda feature nova passa pelo teste "vale a complexidade?".
- **Postgres é o backend**. Lógica de negócio em RLS/triggers/RPC quando possível.
- **Documentação acompanha código**. Migration nova = entrada em DATABASE.md.
- **Vintage não negocia**. Qualquer novo componente respeita Playfair Display + Lora + paleta `--ink` / `--gold`.

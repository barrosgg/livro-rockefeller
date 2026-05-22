# Frontend

Single-page app em React 18 + Vite. Sem TypeScript, sem framework CSS, sem state manager — providers React + hooks dão conta do recado.

## Estrutura de pastas

```
src/
├── main.jsx               # entry: ReactDOM.render + providers + Router
├── App.jsx                # rotas + Layout + Topbar + Protected route guard
├── components/            # widgets reutilizáveis
├── pages/                 # 1 arquivo por rota
├── lib/                   # providers (auth, settings, ui) + utilitários puros
└── styles/                # CSS por área (theme global + páginas específicas)
```

## Rotas

### Públicas (sem login)

| Caminho | Componente | RPC backend |
|---|---|---|
| `/login` | `Login` | – |
| `/p/:token` | `PedidoPublico` | `get_order_public` |
| `/c/:code` | `CredencialPublica` | `get_profile_public` |
| `/r/:code` | `ReciboPublico` | `get_recibo_public` |

### Autenticadas (dentro de `<Layout />`)

| Caminho | Componente | Roles permitidos |
|---|---|---|
| `/` | redirect → `/pedidos` | todos |
| `/pedidos` | `Pedidos` | todos |
| `/pedidos/:id` | `PedidoDetalhe` | todos |
| `/novo` | `NovoPedido` | gerente, proprietario |
| `/meus` | `MeusTrabalhos` | todos |
| `/perfil` | `Perfil` | todos |
| `/ajuda` | `Ajuda` | todos |
| `/admin` | `Admin` | proprietario |

O componente `<Protected allow={[...]}>` cuida de:
- Esperar `loading` e `profileReady`
- Redirecionar para `/login` se não autenticado
- Redirecionar para `/perfil` se profile incompleto
- Bloquear se `profile.disabled = true`
- Bloquear por role se `allow` for fornecido

## Páginas

### `Login`
Card único com botão Discord OAuth. Background = `imagem-fazenda.png` com camada warm + vinheta + poeira dourada + névoa rasteira. Card alinhado à esquerda com efeito frosted glass.

### `Perfil`
Tabs: **Dados** · **Avatar** · **Contrato** · **Conquistas** · **Credencial**. Inclui o card `Credencial` em escala 0.85 com botão de download PNG.

### `Pedidos`
Listagem com filtros (status, busca por short_code/cliente, intervalo de datas). Tabela responsiva: vira card em mobile via `data-label`.

### `NovoPedido`
Wizard de criação: adiciona linhas de `ProdutoCombo`, calcula bruto/desconto, salva em status `rascunho`. Templates podem pré-popular itens.

### `PedidoDetalhe`
Núcleo do app. Gerente aprova / cancela / confirma pagamentos. Trabalhador vê formulário de claim (se contrato assinado). Mostra `StatusTimeline` no topo.

### `MeusTrabalhos`
Lista os claims do usuário atual com totais ganhos. Botão "Recibo" leva ao `/r/:code` quando o claim está `pago`.

### `Admin`
9 abas: Dashboard · Produtos · Usuários · Categorias · Configurações · Templates · Auditoria · Backup · Sobre. Tela onde Proprietário ajusta tudo em runtime.

### `Ajuda`
Documentação navegável dentro do app — papéis, fluxo, atalhos, perguntas frequentes.

### `PedidoPublico`, `CredencialPublica`, `ReciboPublico`
Renderizam dado vindo de RPC `SECURITY DEFINER`. Sem botões de ação, só visualização + download PNG.

## Providers (lib/)

### `auth.jsx` — `AuthProvider`
Encapsula o cliente Supabase + sessão. Expõe:
- `user` (objeto Auth)
- `profile` (linha da tabela `profiles`)
- `loading` (sessão ainda hidratando)
- `profileReady` (já fez a busca do profile — evita race no F5)
- `signOut()`
- `refreshProfile()`
- `isProfileComplete(profile)` (helper exportado)

### `settings.jsx` — `SettingsProvider`
Carrega a tabela `settings` (key/value JSONB) uma vez e expõe `settings`, `setSetting(key, value)`. Usado para `commission_pct`, `farm_name`, `categorias`.

### `ui.jsx` — `UIProvider`
Toasts + diálogos de confirmação imperativos:
```js
const { toast, confirmar } = useUI();
toast('Salvo!', { type: 'success' });
const ok = await confirmar('Tem certeza?', { confirmLabel: 'Sim' });
```

## Utilitários (lib/)

| Arquivo | Conteúdo |
|---|---|
| `supabase.js` | Cliente Supabase singleton, lê `VITE_SUPABASE_*` do env |
| `calc.js` | `calcularBruto`, `calcularComissao`, `calcularLiquido` |
| `csv.js` | Serializa array → CSV com escaping de aspas |
| `export.js` | `downloadPNG(node, filename)` via html2canvas |
| `storage.js` | `useLocalStorage(key, initial)` hook |
| `avatars.js` | Catálogo de avatares disponíveis (slug → URL) |
| `badges.js` | Catálogo de conquistas + `check(stats)` para auto-ganhos |
| `a11y.js` | `useFocusTrap(ref)`, helpers de foco para modal |

## Componentes principais

| Componente | Função |
|---|---|
| `Topbar` (em App.jsx) | Logo + nav + avatar + botão Sair (com hambúrguer em mobile) |
| `Footer` | Carta timbrada vintage com logo SVG no canto |
| `Avatar` | Renderiza avatar circular (slug do catálogo ou iniciais) |
| `AvatarPicker` | Grade de seleção de avatar |
| `Credencial` | Carteira oficial do trabalhador (frente + verso), exportável em PNG |
| `Contrato` | Visualização + assinatura eletrônica do contrato |
| `Conquistas` | Grid de medalhas com `Medal` (auto-ganhas via `badges.js` + `badges_extras`) |
| `Medal` | Círculo com cor por tier (gold/silver/bronze) + símbolo unicode |
| `ProductIcon` | SVG do produto via `<img>` (pasta `/icons/<autor>/<slug>.svg`) |
| `ProdutoCombo` | Combobox de produto com busca + ícone, usado em NovoPedido |
| `StatusTimeline` | Linha horizontal de etapas do pedido com etapa atual destacada |
| `Onboarding` | Modal de boas-vindas (4 slides) com focus trap |
| `ErrorBoundary` | Catch global, exibe tela de erro com botão de recarregar |
| `ScrollToTop` | Sobe `window` ao mudar rota + foca `<main>` para a11y |

## CSS

| Arquivo | Conteúdo |
|---|---|
| `theme.css` | Variáveis (`--ink`, `--gold`, `--bg`, etc), reset, base, topbar, footer, botões, tabelas, paginação, badges de role, formulários |
| `login.css` | Background fazenda + frosted glass + animações |
| `credencial.css` | Carteira oficial: frente, verso, faixa lateral, hologramas |
| `contrato.css` | Documento estilo papel timbrado |
| `recibo.css` | Recibo de produção (área pública) |
| `onboarding.css` | Modal de boas-vindas (slides + paginação por bolinhas) |

### Convenções

- **Variáveis CSS** centralizadas no `:root` de `theme.css`. Nunca hardcode `#hex` em componente — referencie `var(--ink-2)`.
- **Mobile-first com breakpoint `800px`**: media queries pequenas, layout principal já flexível por padrão.
- **Sem CSS-in-JS**. Apenas `style={{}}` inline para valores dinâmicos (ex: `width: progresso + '%'`).
- **Animações** com `prefers-reduced-motion` respeitado quando relevante.

## Padrões de código

- **Imports relativos** com extensão `.jsx` explícita (necessário para Vite resolver corretamente).
- **`async/await`** em handlers, sempre dentro de `try/catch` que dispara `toast({ type: 'error' })`.
- **Sem `useReducer`**: estado local fica em `useState` simples. Para casos com 5+ flags, considere refactor antes de migrar.
- **`useCallback`/`useMemo`** apenas quando há dependência real (lista grande, componente memoizado abaixo). Não decorar tudo.
- **Listas**: `key={item.id}` sempre que possível, nunca `key={index}`.
- **Formulários**: campos controlados com `useState`. Submit faz validação local + chama Supabase. Erro vira toast.

## Acessibilidade

Implementado em `lib/a11y.js` e respeitado em todos os modais/diálogos:

- **Focus trap** em `<Onboarding />`, `<ConfirmDialog />` (do `UIProvider`), `<Contrato>` (modal de assinatura)
- **Skip link** "Pular para o conteúdo" no topo de `<Layout />`
- **ARIA**:
  - `aria-label` em botões só com ícone
  - `aria-current="page"` automático em `<NavLink>`
  - `aria-live="polite"` em estados de loading
  - `aria-sort` em cabeçalhos de tabela ordenáveis
- **Touch targets** ≥ 38px (24px+padding) — variante `.sm` cai a 32px
- **Contraste WCAG AA** em todas as combinações `--ink*` / `--bg*`

## Atalhos de teclado

| Tecla | Onde | Ação |
|---|---|---|
| `Esc` | Modais | Fecha (Onboarding, Confirm, Contrato) |
| `Tab` / `Shift+Tab` | Modais | Navega dentro do focus trap |
| `Enter` | Formulários | Submete |
| `/` | Pedidos (planejado) | Foco no campo de busca |

## Performance

- Vite faz code-splitting automático por rota dinâmica — aqui as páginas estão importadas estaticamente em `App.jsx` (app pequeno, bundle inteiro ~150KB gz).
- `html2canvas` é carregado via dynamic import só quando o usuário clica em "Baixar PNG".
- `<img loading="lazy">` em ícones de produto na lista.
- Sem virtualization — tabelas raramente passam de ~50 linhas no caso de uso atual.

## Internacionalização

App está 100% em **Português (PT-BR)**. Não há plano de i18n. Strings ficam inline nos componentes.

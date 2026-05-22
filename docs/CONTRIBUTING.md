# Contribuindo

Guia para quem mexe no código do Caderno. Foco em convenções práticas — não em filosofia.

## Setup

```bash
git clone https://github.com/barrosgg/livro-rockefeller.git
cd livro-rockefeller
npm install
cp .env.example .env       # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

Aponte para um **projeto Supabase próprio** (mesmo que vazio) — nunca para o de produção. Veja [DEPLOYMENT.md](DEPLOYMENT.md) para criar.

## Scripts

```bash
npm run dev       # Vite dev server (http://localhost:5173)
npm run build     # Build de produção em /dist
npm run preview   # Serve /dist localmente para sanity check
```

Não há lint/test/format configurados. **Mantenha simples**.

## Estrutura de branches

- `main` — produção. Vercel auto-deploya cada push.
- `feature/<curto>` — features em progresso. Merge via PR ou fast-forward.
- Sem branches `develop`/`staging` — preview do Vercel cobre.

## Convenções de commit

Mensagens curtas em **português**, modo imperativo:

```
add credencial pública
fix race em AuthProvider no F5
docs: arquitetura inicial
chore: bump html2canvas
```

Sem Conventional Commits estrito. Sem changelog automático. Mantenha legível pra quem ler `git log` em 6 meses.

## Convenções de código

### JavaScript / JSX

- **Sem TypeScript.** Use JSDoc só quando ajudar.
- **`async/await`** em handlers, sempre dentro de `try/catch` que dispara `toast({ type: 'error' })`.
- **Estado local** com `useState`. Subir pro contexto só se 3+ componentes precisarem.
- **`useCallback`/`useMemo`** apenas com motivo real (dep de outro hook, prop de componente memoizado).
- **Listas**: `key={item.id}` sempre. Nunca `key={index}`.
- **Imports relativos** com extensão `.jsx`/`.js` explícita (Vite ESM).
- **Nomes em PT-BR** quando o domínio é PT-BR (pedido, claim, trabalhador). Helpers genéricos em inglês (`useLocalStorage`).

### CSS

- **Variáveis** no `:root` de `theme.css`. Nunca hardcode `#hex` em componente — use `var(--gold)`.
- **Tema vintage não negocia**: Playfair Display nos títulos, Lora no corpo, paleta sépia.
- **Mobile-first** com breakpoint em `800px`.
- **Sem CSS-in-JS**. Inline `style={{}}` só para valor dinâmico (ex: `width: pct + '%'`).
- **Animações** respeitam `prefers-reduced-motion` quando o efeito for grande.

### SQL / Migrations

- Cada mudança = novo arquivo `supabase/migrations/NNN_descricao.sql` (próximo número livre)
- **Sempre idempotente**: `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS … CREATE POLICY`, etc.
- Após criar, atualize [DATABASE.md](DATABASE.md) com a nova linha
- RLS em **todas as tabelas novas**, sempre — mesmo que a política seja `USING (true)`
- Use `SECURITY DEFINER` em funções que precisam bypass de RLS, mas seja explícito sobre o motivo no comentário

## Fluxo para nova feature

1. Branch `feature/nome-curto`
2. Implemente; verifique manualmente em `npm run dev`
3. Se mexer no banco, escreva migration **e rode no seu Supabase de teste**
4. Atualize docs relevantes (`DATABASE.md`, `FRONTEND.md`, `ROADMAP.md`)
5. Build local: `npm run build && npm run preview` — confirme que builda e roda
6. Commit, push, PR (ou direto em `main` se trivial)
7. **No Supabase de produção**: rode a migration **antes** do deploy do frontend
8. Push em `main` → Vercel publica

## Adicionando produto novo

Sem UI ainda — Proprietário usa a aba **Admin → Produtos** que faz INSERT direto.

Para seed em SQL:
```sql
INSERT INTO products (nome, categoria, preco_min, preco_max, icon)
VALUES ('Café Selecionado', 'Bebidas', 8.00, 12.00, 'delapouite/coffee-cup');
```

Ícones disponíveis em `/public/icons/<autor>/<slug>.svg`. Veja [game-icons.net](https://game-icons.net) (Lorc e Delapouite são as duas pastas usadas).

## Adicionando conquista (badge)

Edite `src/lib/badges.js` adicionando objeto novo ao array `BADGES`:

```js
{
  id: 'thousand_orders',
  tier: 'gold',           // gold | silver | bronze
  symbol: '◆',             // unicode discreto
  emoji: '💎',
  nome: 'Mil Pedidos',
  desc: 'Concluiu 1000 produções',
  check: (s) => s.claims_total >= 1000,
}
```

`s` é o objeto de stats calculado em `Conquistas.jsx`. Adicione campo novo lá se precisar de stat inédito.

Conquistas **manuais** (sem `check`) vivem em `profiles.badges_extras` (text[]) e são atribuídas via SQL — não há UI ainda.

## Adicionando avatar

1. Coloque o arquivo em `/public/avatars/<slug>.png` (recomendado 256×256)
2. Adicione a entrada em `src/lib/avatars.js`:
```js
{ slug: 'arthur', nome: 'Arthur Morgan' }
```

## Adicionando rota

1. Crie `src/pages/MinhaPage.jsx`
2. Importe em `App.jsx`
3. Adicione `<Route>` dentro do `<Layout>` (autenticada) ou fora (pública)
4. Se autenticada, embrulhe em `<Protected allow={['gerente','proprietario']}>` se houver restrição de role

## Padrões de acessibilidade

Para qualquer componente novo:
- Botão só com ícone? `aria-label="O que ele faz"`
- Modal? `useFocusTrap()` + `Esc` fecha
- Loading? `aria-live="polite"` na região que muda
- Tabela ordenável? `aria-sort` no `<th>`
- Cor ≠ informação única (sempre tenha label/ícone alternativo)

Cheque contraste em <https://webaim.org/resources/contrastchecker/> se alterar tinta — alvo WCAG AA (4.5:1 normal, 3:1 large).

## Segurança

- **Nunca** commit de `.env`, `service_role` key ou senha de banco
- **Nunca** desabilite RLS em produção sem motivo escrito + revisão
- **Sempre** valide no banco o que o frontend valida (defense in depth)
- Logs do Discord OAuth não devem aparecer em código — Supabase já guarda

## Conversando com o time

- Bug crítico em produção → mensagem direta no Discord do Proprietário
- Sugestão / discussão → issue no GitHub (label `discussion`)
- Ideia "futuro" → adicione em [ROADMAP.md](ROADMAP.md) em "Em consideração"

## Filosofia

> *Simplicidade > completude. Postgres é o backend. Documentação acompanha código. Vintage não negocia.*

Quando em dúvida sobre adicionar dependência / abstração / config: **não adicione**. Volte a aprovar quando a dor de não ter for real, não hipotética.

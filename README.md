# Caderno da Fazenda Rockefeller

Sistema de gestão de pedidos, produção e pagamentos da Fazenda Rockefeller (RDR2 roleplay) — sucessor da calculadora original [barrosgg/rockefeller](https://github.com/barrosgg/rockefeller).

**Stack:** React + Vite · Supabase (Postgres + Auth Discord + RLS) · hospedagem estática gratuita (Cloudflare Pages / Vercel / Netlify).

---

## Fluxo do sistema

1. **Gerente** cria orçamento (reaproveita a calculadora) e ao aprovar define o **prazo de entrega**.
2. Pedido entra em produção; **Trabalhadores** podem assumir *parte* dos itens (ex.: 100 de 200 maçãs) — o saldo restante fica em aberto para outros.
3. Ao assumir, o trabalhador informa a data prevista de entrega e já vê a remuneração líquida (−25% de comissão da Fazenda).
4. Ao concluir, o trabalhador acessa o pedido e marca **entregue no baú** (data/hora).
5. Após a entrega, o **Gerente** marca o pagamento como efetuado.
6. Quando todos os itens estão pagos e o saldo zera, o pedido é **concluído** automaticamente.

**Roles:** `proprietario`, `gerente`, `trabalhador`.

---

## 1. Configurar o Supabase (grátis)

1. Crie um projeto em <https://supabase.com> (free tier: 500 MB DB, 50k MAU).
2. Em **SQL Editor**, abra um novo script, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e execute **Run**.
   Isso cria as tabelas, enums, view de saldo, políticas de RLS e popula o catálogo de 61 produtos.
3. Configure o **Auth do Discord**:
   - Em <https://discord.com/developers/applications> crie uma aplicação OAuth2.
   - **Redirects** → adicione `https://<seu-projeto>.supabase.co/auth/v1/callback`.
   - Copie `Client ID` e `Client Secret`.
   - No Supabase: **Authentication → Providers → Discord** → cole as credenciais e ative.
   - Em **Authentication → URL Configuration**: defina `Site URL` (ex.: `http://localhost:5173` em dev; em prod, o domínio do Cloudflare Pages).
4. Em **Project Settings → API**, copie `Project URL` e `anon public key`.
5. Promova você mesmo a Proprietário (uma vez):
   ```sql
   update profiles set role = 'proprietario' where discord_handle = 'seu_handle';
   ```
   (depois, pela tela `/admin` você atribui Gerente/Trabalhador aos demais).

## 2. Rodar localmente

```bash
cp .env.example .env
# preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Abra <http://localhost:5173>.

## 3. Deploy gratuito (Cloudflare Pages — recomendado)

> Você **não** precisa usar Cloudflare obrigatoriamente. Qualquer host de site estático serve (Vercel, Netlify, GitHub Pages). Cloudflare Pages é o de free tier mais generoso (builds e banda ilimitadas).

1. Suba o repositório para o GitHub.
2. Em <https://dash.cloudflare.com> → **Workers & Pages → Create → Pages → Connect to Git**.
3. Build command: `npm run build` · Build output: `dist`.
4. Adicione as variáveis de ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em **Settings → Environment Variables**.
5. Após o primeiro deploy, copie o domínio (`xxxx.pages.dev`) e:
   - No **Supabase → Authentication → URL Configuration** adicione esse domínio em `Site URL` e `Additional Redirect URLs`.
   - No **Discord Developer Portal** o redirect continua sendo o do Supabase — não muda.

### Alternativas equivalentes

| Serviço | Como fazer |
|---|---|
| **Vercel** | `vercel` na CLI, ou import do repo. Preencha as duas envs. |
| **Netlify** | `netlify deploy --prod`, ou import do repo. Build: `npm run build`, publish: `dist`. |
| **GitHub Pages** | Adicione `base: '/<repo>/'` no `vite.config.js` e suba `dist/` via action. |

---

## Estrutura do projeto

```
src/
  lib/
    supabase.js      cliente Supabase
    auth.jsx         AuthProvider + useAuth (Discord OAuth)
    calc.js          subtotal/total, comissão 25% / 75% trabalhador
  pages/
    Login.jsx        entrada com Discord
    Perfil.jsx       nome, ID, Discord, conta bancária
    Pedidos.jsx      lista filtrada por status
    NovoPedido.jsx   calculadora (gerente) — cria orçamento e aprova
    PedidoDetalhe.jsx itens, claims, ações de entrega/pagamento
    MeusTrabalhos.jsx histórico do trabalhador
    Admin.jsx        proprietário atribui roles
  styles/theme.css   tema vintage 1900 (cinzel, pergaminho, ouro)
supabase/
  schema.sql         tabelas, RLS, seed dos produtos
_legacy/             cópia da calculadora original (referência — gitignored)
```

## Status do pedido

```
rascunho → aprovado → em_producao → entregue → pago → concluido
                                    └──────── cancelado (a qualquer momento)
```

Cada **claim** (produção assumida) tem seu próprio ciclo `em_producao → entregue → pago`. O pedido só vira `concluido` quando o saldo em aberto chega a zero e todos os claims estão pagos.

## Comissão / remuneração

Definida em [src/lib/calc.js](src/lib/calc.js):

```js
export const COMISSAO_PCT = 0.25;   // Fazenda retém 25%
```

Para mudar a regra, edite essa constante.

---

## Verificação end-to-end (manual)

1. **Setup**: rode `npm run dev`, faça login com Discord, complete o Perfil. Promova seu usuário a `proprietario` via SQL.
2. **Criar pedido**: como Proprietário (ou Gerente após promover outro usuário), vá em `/novo`, adicione itens, defina prazo, clique **Aprovar**.
3. **Assumir produção**: com um segundo usuário (trabalhador), abra o pedido, escolha qtd. parcial de alguns itens, defina data prevista, confirme. Confira o cálculo de líquido (75%).
4. **Entrega**: como trabalhador, clique **Confirmar entrega no baú**.
5. **Pagamento**: como Gerente, no claim entregue, clique **Marcar como Pago**.
6. **Conclusão**: quando todos os claims cobrirem 100% dos itens e estiverem pagos, status do pedido muda para `concluido`.

## Origem

Calculadora original (vanilla JS): <https://github.com/barrosgg/rockefeller>. O catálogo de produtos e o tema visual foram preservados; toda a lógica de pedido/produção/pagamento é nova.

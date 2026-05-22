# Deploy

Setup do zero ao ar em ~30 minutos. Stack: **Supabase** (backend) + **Vercel** (frontend) + **Discord** (OAuth provider).

## 1. Supabase

### 1.1 Criar projeto

1. Acesse <https://supabase.com>, login (free tier basta)
2. **New project** → escolha região mais próxima (ex: `sa-east-1` São Paulo)
3. Anote: **Project URL** e **anon public key** (Settings → API)
4. Anote (e guarde em local seguro): **database password** — só usado em conexões diretas, **nunca** coloque no código

### 1.2 Configurar Discord OAuth

1. <https://discord.com/developers/applications> → **New Application** → nome livre
2. Aba **OAuth2** → adicione redirect URI:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
3. Copie **Client ID** e **Client Secret**
4. No Supabase: **Authentication → Providers → Discord** → cole ID + Secret → habilite

### 1.3 URLs de redirecionamento

No Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://<seu-dominio>.vercel.app`
- **Redirect URLs** (uma por linha):
  ```
  https://<seu-dominio>.vercel.app/**
  http://localhost:5173/**
  ```

### 1.4 Rodar schema + migrations

Em **SQL Editor**:

1. Cole `supabase/schema.sql` inteiro → **Run**
2. Para cada arquivo em `supabase/migrations/` (em ordem numérica: `003`, `004`, …, `020`) cole o conteúdo → **Run**
3. Migration `002_public_link.sql` está obsoleta (usava `public_token` UUID, substituído por `public_code` em 003). Pode pular.

Verifique se as tabelas existem em **Table Editor**: `profiles`, `products` (61 linhas seedadas), `orders`, `order_items`, `claims`, `claim_items`, `settings`, `audit_log`, `order_templates`, `order_template_items`.

### 1.5 Promover Proprietário

O primeiro signup vira `trabalhador` por default. Para promover você mesmo, no SQL Editor:

```sql
UPDATE profiles
SET role = 'proprietario'
WHERE discord_handle = 'seu_handle';
```

Aí você pode promover outros pela aba **Admin → Usuários** sem precisar mexer no SQL de novo.

## 2. Vercel

### 2.1 Conectar repositório

1. <https://vercel.com> → **Add New… → Project**
2. Importe o repositório GitHub `livro-rockefeller`
3. Framework Preset: **Vite** (auto-detectado)
4. Build Command: `npm run build`
5. Output Directory: `dist`

### 2.2 Variáveis de ambiente

Em **Settings → Environment Variables**:

| Nome | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | a chave **anon public** (não a service_role!) |

Aplicar a **Production**, **Preview** e **Development**.

> A `anon key` é projetada para ser pública — RLS protege os dados. **Nunca** exponha `service_role` no frontend; ela bypassa RLS.

### 2.3 vercel.json

Já versionado na raiz. Faz rewrite SPA para que `/pedidos/abc123` funcione no F5:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

### 2.4 Deploy

Push para `main` → Vercel builda automaticamente. Domínio default: `livro-rockefeller.vercel.app`.

## 3. Dev local

```bash
git clone https://github.com/barrosgg/livro-rockefeller.git
cd livro-rockefeller
npm install
cp .env.example .env
# editar .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev   # http://localhost:5173
```

`localhost:5173` precisa estar nas **Redirect URLs** do Supabase, senão o OAuth Discord falha.

## 4. Atualizando produção

### Frontend
```bash
git push origin main
```
Vercel builda e publica sozinho. Rollback: aba **Deployments** → "Promote to Production" em build anterior.

### Banco
1. Crie `supabase/migrations/NNN_descricao.sql` (próximo número livre)
2. Use sempre `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, etc — migrations devem ser **idempotentes**
3. Rode no SQL Editor do Supabase
4. Commit do `.sql` para o repositório

> Não use o CLI `supabase db push`. Mantemos workflow manual via SQL Editor para reviso visual + simplicidade.

## 5. Custos

| Serviço | Free tier cobre? | Limites |
|---|---|---|
| **Vercel Hobby** | Sim | 100GB bandwidth/mês, builds ilimitados (não-comercial) |
| **Supabase Free** | Sim | 500MB DB, 1GB storage, 50k MAU, pausa após 7 dias inativos |
| **Discord OAuth** | Sim | Sem limite relevante |

Backup automático Supabase: **7 dias** de retenção no free tier.

## 6. Domínio próprio (opcional)

1. Vercel → **Settings → Domains → Add**
2. Aponte CNAME no seu DNS para `cname.vercel-dns.com`
3. Atualize **Site URL** e **Redirect URLs** no Supabase para o novo domínio
4. Atualize o redirect URI no Discord Developer Portal

## 7. Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| `404 NOT_FOUND` em rotas `/pedidos/xyz` | Sem `vercel.json` ou SPA rewrite | Confirme `vercel.json` na raiz |
| Login Discord redireciona mas não loga | Redirect URL ausente | Adicione `<dominio>/**` em Supabase URL Configuration |
| `permission denied for table profiles` | RLS sem `GRANT` ao role `authenticated` | Rode os `GRANT` do schema.sql |
| F5 cai em `/perfil` toda vez | Race em `profileReady` | Já tratado em `auth.jsx` — confirme versão |
| `public_token does not exist` | Migration 018 não rodada | Rode `018_fix_rpc_no_public_token.sql` |
| Conta pausada por inatividade (Supabase) | 7 dias sem requests | Clique **Resume** no dashboard, dados intactos |

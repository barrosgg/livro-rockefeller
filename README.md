# Livro da Fazenda Rockefeller

Sistema de gestão de pedidos, produção e pagamentos da **Família Rockefeller** — fazenda fictícia de RP em Red Dead Redemption 2. Sucessor da [calculadora original](https://github.com/barrosgg/rockefeller).

> Livro onde se registram orçamentos, produção, entregas e pagamentos da fazenda. Cliente abre um pedido com o Gerente, trabalhadores assumem partes da produção, entregam no baú e recebem remuneração (75% líquido, 25% comissão da Fazenda).

## Stack

- **Frontend**: React 18 + Vite + React Router 6 (sem TypeScript)
- **Backend**: Supabase (Postgres + Auth via Discord OAuth + RLS)
- **Hospedagem**: Vercel (frontend) + Supabase Cloud (DB+Auth)
- **Estilo**: CSS puro (sem Tailwind) com tema vintage 1900 (Playfair Display + Lora)
- **Ícones de produto**: [game-icons.net](https://game-icons.net) (Lorc & Delapouite, CC BY 3.0)

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Visão geral, fluxos, decisões de design |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, RLS, RPCs, migrations |
| [docs/FRONTEND.md](docs/FRONTEND.md) | Rotas, componentes, libs, padrões |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Setup Supabase + Vercel + variáveis |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Features concluídas + ideias futuras |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Fluxo de dev, convenções, scripts |

## Quick Start

```bash
# 1. Clonar e instalar
git clone https://github.com/barrosgg/livro-rockefeller.git
cd livro-rockefeller
npm install

# 2. Configurar Supabase
cp .env.example .env
# preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY

# 3. Rodar migrations no Supabase SQL Editor (em ordem):
#    supabase/schema.sql + migrations/002 a 020

# 4. Dev local
npm run dev   # http://localhost:5173

# 5. Build de produção
npm run build
```

## URLs em produção

- **App**: <https://livro-rockefeller.vercel.app>
- **Repo**: <https://github.com/barrosgg/livro-rockefeller>

## Créditos de assets

- **Ícones de produto**: [Lorc](https://lorcblog.blogspot.com/) e [Delapouite](https://delapouite.com/) via [game-icons.net](https://game-icons.net) sob licença [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- **Logotipo Família Rockefeller**: arte do projeto

# Vellor — e-commerce de relógios de luxo e perfumes de nicho

Loja própria (Brasil, pt-BR) com painel administrativo, construída seguindo o
[Engineering Blueprint](docs/adr/0001-stack-e-arquitetura.md): monólito modular em
TypeScript, API server-authoritative, contrato OpenAPI, sessões server-side com MFA
para o admin, auditoria, outbox transacional e deploy em VPS com Docker Compose.

| Camada               | Tecnologia                                                                |
| -------------------- | ------------------------------------------------------------------------- |
| Front (loja + admin) | React 19, react-router 7, TanStack Query, Tailwind CSS 4, Vite            |
| API                  | NestJS 11, Zod 4 (nestjs-zod), Drizzle ORM, PostgreSQL 17                 |
| Pagamentos           | Asaas (Pix, boleto, cartão em até 12x) via API + webhook                  |
| Frete                | Correios com seguro (API oficial com contrato) + tabela de contingência   |
| Infra                | Docker (Alpine, sem root), Caddy (TLS automático), backup diário do banco |

## Estrutura do repositório

```
apps/
  api/        API NestJS (src/modules/*, database/schema, drizzle/ migrations, openapi.json)
  web/        Loja e painel /admin (src/pages/store, src/pages/account, src/pages/admin)
packages/
  shared/     Contratos Zod, tipos, enums com rótulos pt-BR, utilitários (dinheiro, CPF, CEP)
infra/        docker-compose (dev e prod), Caddyfile, scripts de backup do Postgres
docs/         ADRs, runbook de deploy, guia do catálogo, checklist de segurança/LGPD
.github/      CI (lint, tipos, testes, build, contrato OpenAPI, e2e, imagens, segurança)
```

## Rodando localmente

Pré-requisitos: Node 22+, pnpm 10 (`corepack enable`), PostgreSQL 17 (ou Docker).

```bash
pnpm install
cp .env.example .env                      # ajuste DATABASE_URL se necessário
docker compose -f infra/docker-compose.yml up -d   # Postgres 17 + Mailpit (opcional)
pnpm db:migrate                           # aplica as migrations
pnpm db:seed                              # admin + catálogo de demonstração
pnpm dev                                  # API em :3001 e web em :3000 (proxy /api)
```

- Loja: http://localhost:3000 · Painel: http://localhost:3000/admin
- Admin de desenvolvimento: `admin@vellor.local` / `VellorAdmin#2026` (no primeiro acesso o painel exige ativar o MFA com um app autenticador)
- Documentação da API (fora de produção): http://localhost:3001/api/docs
- Sem `ASAAS_API_KEY` os pagamentos são **simulados**: a página do pedido mostra um botão para aprovar o pagamento.

### Scripts úteis

| Comando                                                      | O que faz                                                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `pnpm lint` / `pnpm format`                                  | ESLint / Prettier em todo o monorepo                                                           |
| `pnpm typecheck`                                             | `tsc --noEmit` em todos os pacotes                                                             |
| `pnpm test`                                                  | Testes unitários e de integração (a API usa `DATABASE_URL`, apontando para um banco de testes) |
| `pnpm e2e`                                                   | Playwright (loja + admin) com a API em modo simulado                                           |
| `pnpm build`                                                 | Build de shared, API e web                                                                     |
| `pnpm openapi`                                               | Regenera `apps/api/openapi.json` (a CI falha se estiver desatualizado)                         |
| `pnpm db:generate`                                           | Gera migration SQL a partir do schema Drizzle                                                  |
| `pnpm db:migrate` / `pnpm db:seed`                           | Aplica migrations / cria admin e dados de demonstração                                         |
| `pnpm --filter @vellor/api db:seed -- --remove-placeholders` | Remove o catálogo de demonstração                                                              |

## Arquitetura em uma imagem

```mermaid
flowchart LR
  Browser((Cliente / Admin)) -->|HTTPS 443| Caddy
  Caddy -->|/ (SPA estática)| Web[React build]
  Caddy -->|/api, /uploads| API[NestJS]
  API --> PG[(PostgreSQL 17)]
  API -->|cobranças + webhook| Asaas
  API -->|preço/prazo| Correios
  API -->|SMTP| Email[E-mail transacional]
  API --> Uploads[(Volume de imagens)]
  Backup[pg_dump diário] --> PG
```

Princípios aplicados: regras de negócio, autenticação e autorização só no servidor;
uma única porta pública (Caddy); segredos em variáveis de ambiente; dinheiro em
centavos inteiros; migrations versionadas; logs JSON com `request_id`; métricas
Prometheus em `/metrics` (rede interna); trilha de auditoria imutável; efeitos
colaterais (e-mails) via outbox com retry e dead-letter.

## Funcionalidades

**Loja**: home editorial, categorias Relógios e Perfumes de Nicho com coleções,
filtros, busca, página de produto com ficha técnica por tipo, favoritos, sacola
persistente, cupom, cálculo de frete com seguro por CEP, checkout como visitante
ou logado (CEP automático, endereços salvos), pagamento Pix (QR code), boleto ou
cartão (página segura do Asaas, parcelas), acompanhamento do pedido com rastreio,
conta do cliente (pedidos, endereços, dados, senha), atendimento por WhatsApp e
formulário, newsletter com consentimento, páginas legais.

**Admin** (`/admin`, exige MFA TOTP): dashboard de vendas, pedidos com ações
(confirmar pagamento, separar, enviar com rastreio, entregar, cancelar, reembolsar,
anotar), produtos com variações, estoque, ficha técnica por categoria e upload de
imagens, categorias e coleções, cupons, clientes, atendimento, newsletter (CSV),
configurações da loja (identidade, frete, parcelamento, textos legais) e auditoria.

## Deploy

- **Coolify** (recomendado): [docs/runbook-coolify.md](docs/runbook-coolify.md). Build pack
  Docker Compose apontando para `docker-compose.coolify.yml`, domínio no serviço `web`,
  variáveis na interface e deploy a cada push na `main`.
- **VPS com Docker Compose**: [docs/runbook-deploy.md](docs/runbook-deploy.md). Resumo: `.env`
  preenchido e `docker compose --env-file .env -f infra/docker-compose.prod.yml up -d --build`.

Nos dois casos a API aplica as migrations e cria o primeiro administrador
(`ADMIN_EMAIL`/`ADMIN_PASSWORD`) ao iniciar; não há comando manual.

## Documentação

- [ADRs](docs/adr/) — decisões de arquitetura (stack, pagamentos, frete, auth, outbox, storage)
- [Deploy com Coolify](docs/runbook-coolify.md)
- [Runbook de deploy manual, backup e rollback](docs/runbook-deploy.md)
- [Guia do catálogo](docs/catalogo.md) — o que enviar (fotos, fichas técnicas) e como cadastrar
- [Segurança e LGPD](docs/seguranca-e-lgpd.md) — checklist antes do go-live

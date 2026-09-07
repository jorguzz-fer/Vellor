# ADR 0001 — Stack e arquitetura: backend próprio (monólito modular) em vez de plataforma de e-commerce

- Status: aceito
- Data: 2026-09-07

## Contexto

O projeto nasceu de um template visual (React + Vite + Tailwind) sem backend. O cliente
descartou o Shopify (custo) e perguntou se existiria um backend open source equivalente.
Requisitos fixos: Brasil (pt-BR, BRL, Pix/boleto/cartão via **Asaas**), frete **Correios
com seguro**, PostgreSQL 17 em Docker, painel administrativo próprio, catálogo de relógios
de luxo e perfumes de nicho, e o [Engineering Blueprint](../../README.md) da equipe
(TypeScript end-to-end, monólito modular, server-authoritative, OpenAPI, MFA, auditoria,
Docker Compose em VPS).

## Opções consideradas

1. **Medusa.js (open source)** — domínio de e-commerce pronto (produtos, carrinho, pedidos,
   admin). Contras: admin em inglês e com modelo de dados próprio; Asaas e Correios não
   têm providers oficiais (teria de escrever módulos custom do mesmo jeito); stack pesada
   (workflows, Redis recomendado); pouca aderência ao blueprint (MFA, auditoria, RLS,
   estrutura NestJS). Ganho pequeno para um catálogo boutique.
2. **Shopify headless** — descartado pelo cliente (custo mensal + taxas).
3. **Backend próprio em NestJS + Drizzle + PostgreSQL** (escolhida) — total controle do
   domínio (variações, atributos por categoria, reserva de estoque, cupons), pt-BR nativo,
   integrações Asaas/Correios feitas sob medida, aderência direta ao blueprint.

## Decisão

- Monorepo pnpm: `apps/api` (NestJS 11), `apps/web` (React 19 + react-router 7), `packages/shared`.
- **Contrato como fonte de verdade**: schemas Zod em `packages/shared` validam requisições e
  respostas na API (nestjs-zod) e os formulários do front; a API publica `openapi.json`
  gerado a partir deles, verificado na CI.
- **Drizzle ORM** (schema em TS, SQL previsível, migrations SQL versionadas) em vez de Prisma
  (binários nativos problemáticos em Alpine).
- UUID como chave, `timestamptz`, dinheiro em **centavos inteiros**, `jsonb` só para
  atributos genuinamente flexíveis (ficha técnica) e snapshots (endereço do pedido).
- Sem microserviços: módulos com fronteiras claras (auth, catálogo, checkout, pedidos,
  pagamentos, frete, atendimento, admin) dentro do mesmo processo.

## Consequências

- Precisamos manter o domínio de e-commerce (não há upgrades "de graça" de uma plataforma).
- Em troca, o Admin é exatamente o que a operação precisa, em português, e as integrações
  brasileiras não dependem de plugins de terceiros.
- Versões fixadas em majors estáveis conhecidos (NestJS 11, Zod 4, Drizzle 0.44, Vite 6,
  TypeScript 5.9); atualizações de major devem passar por ADR.

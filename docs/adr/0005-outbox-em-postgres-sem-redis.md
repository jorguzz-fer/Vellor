# ADR 0005 — Efeitos colaterais via outbox no PostgreSQL (sem Redis na v1)

- Status: aceito
- Data: 2026-09-07

## Contexto

E-mails transacionais (pedido criado, pagamento confirmado, envio, redefinição de senha,
atendimento) não podem falhar junto com a requisição nem se perder. O blueprint pede
fluxos assíncronos com retry, back-off e dead-letter, e sugere Redis para filas.

## Decisão

- Tabela `outbox_events` gravada **na mesma transação** do evento de negócio.
- Worker no próprio processo da API (`OutboxWorker`, intervalo `OUTBOX_POLL_MS`) consome
  lotes com `SELECT ... FOR UPDATE SKIP LOCKED` (seguro com várias instâncias), executa o
  handler registrado por tipo e aplica back-off exponencial (10 s × 2ⁿ, teto 1 h). Após 8
  tentativas o evento vai para `dead` e a métrica `vellor_outbox_failures_total` sobe.
- Sem Redis, filas externas ou serviços adicionais na v1.

## Consequências

- Menos infraestrutura para operar num VPS; tudo é backupeado junto com o banco.
- Latência de segundos (não milissegundos) para e-mails: adequado.
- Se surgirem cargas maiores (campanhas, integrações), migrar handlers para BullMQ/Redis
  mantendo a mesma tabela como origem (novo ADR).

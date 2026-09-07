# ADR 0002 — Pagamentos com Asaas (Pix, boleto e cartão pela página segura)

- Status: aceito
- Data: 2026-09-07

## Contexto

Loja brasileira, tíquete alto (relógios de luxo). O cliente escolheu o **Asaas** como
provedor de cobrança. Precisamos de Pix (com QR code na própria loja), boleto e cartão
com parcelamento, sem assumir o ônus de PCI-DSS.

## Decisão

- `PaymentsService` cria cobranças na API v3 do Asaas (`/customers`, `/payments`,
  `/payments/{id}/pixQrCode`, `/payments/{id}/identificationField`). O cliente Asaas é
  reutilizado por CPF e o id fica salvo no usuário (`provider_customer_id`).
- **Pix**: QR code e copia-e-cola exibidos na página do pedido; expiração configurável.
- **Boleto**: link do boleto e linha digitável; vencimento configurável no Admin.
- **Cartão**: a cobrança é criada com `installmentCount` e o cliente conclui o pagamento na
  **página segura do Asaas** (`invoiceUrl`). Nenhum dado de cartão passa pelos nossos
  servidores (sem escopo PCI). Parcelas e juros são definidos nas configurações da loja
  (`calculateInstallments` compartilhado entre API e front).
- **Webhook** `POST /api/v1/webhooks/asaas` autenticado pelo token configurado no painel
  do Asaas (`asaas-access-token`), idempotente por id de evento (tabela
  `payment_webhook_events`). Eventos `CONFIRMED`/`RECEIVED` marcam o pedido como pago,
  baixam o estoque reservado e disparam o e-mail; `OVERDUE`, `REFUNDED` e `DELETED`
  também são tratados.
- **Reserva de estoque**: ao criar o pedido, `reserved_quantity` é incrementada dentro da
  transação (com `SELECT ... FOR UPDATE`); ao pagar, vira baixa definitiva; ao cancelar ou
  expirar (job horário, 5 dias), a reserva é liberada.
- **Modo simulado**: sem `ASAAS_API_KEY` a API gera cobranças fictícias (QR code local) e
  expõe `POST /payments/mock/confirm` para testes e2e. Em produção a inicialização falha
  sem chave, a menos que `PAYMENTS_MOCK=true` seja explícito.

## Consequências

- Não há checkout transparente de cartão na v1; se a conversão exigir, avaliar a
  tokenização do Asaas (`/creditCard/tokenizeCreditCard`) em um ADR futuro, com revisão
  de segurança.
- O status financeiro fica 100% no Asaas; o Admin espelha e permite "confirmar pagamento
  manualmente" para casos excepcionais (auditado).

# ADR 0003 — Frete pelos Correios com seguro (valor declarado) e tabela de contingência

- Status: aceito
- Data: 2026-09-07

## Contexto

Envio exclusivamente pelos **Correios com seguro**, para todo o Brasil. A API pública
antiga de preço/prazo foi descontinuada; a API oficial atual
(`https://api.correios.com.br`, portal CWS) exige **contrato, cartão de postagem e
credenciais** que o cliente ainda não possui. Peças de alto valor podem ultrapassar o
limite de valor declarado dos Correios.

## Decisão

- `CorreiosClient` implementa a API oficial: autenticação por cartão de postagem
  (`/token/v1/autentica/cartaopostagem`), preço (`/preco/v1/nacional`) e prazo
  (`/prazo/v1/nacional`) para **PAC (03298)** e **SEDEX (03220)** com contrato.
- O **seguro** é calculado pela loja (`insurancePercent` sobre o valor declarado, com
  mínimo e teto `maxDeclaredValueCents`, configuráveis no Admin) e somado ao frete. O
  valor é apresentado ao cliente como "frete com seguro" e registrado separadamente no
  pedido (`shipping_cents` + `insurance_cents`). O percentual deve ser alinhado à tarifa
  de valor declarado vigente dos Correios.
- **Contingência**: sem credenciais, ou quando a API falha, a cotação usa a **tabela por
  região** (UF inferida pelo CEP) configurável no Admin. A origem do cálculo é informada
  na resposta (`source: correios | table`) e registrada em log.
- Prazo exibido = prazo dos Correios + dias de postagem (`handlingDays`).
- Dimensões e peso vêm do cadastro do produto; itens são combinados em um pacote
  (soma de pesos e alturas, maior comprimento/largura), respeitando os mínimos dos
  Correios.

## Consequências

- Até obter o contrato, o frete cobrado é o da tabela: revisar os valores no Admin com
  base em cotações reais para não operar no prejuízo.
- Pedidos acima do teto de valor declarado seguem com seguro parcial: o Admin deve avaliar
  seguro adicional ou transportadora especializada (fora do escopo da v1).
- Rastreamento: código informado pelo Admin ao marcar "enviado"; link público dos Correios
  no e-mail e na página do pedido.

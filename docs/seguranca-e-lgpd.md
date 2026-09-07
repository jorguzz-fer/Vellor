# Segurança e LGPD — o que já está implementado e o que falta decidir

## Implementado no código

- Autenticação e autorização só no servidor; sessão em cookie `httpOnly`/`Secure`/`SameSite=Lax`;
  verificação de `Origin` em toda requisição mutável (anti-CSRF).
- Senhas com Argon2id; lockout progressivo; MFA TOTP obrigatório para administradores.
- CPF e segredo do MFA criptografados em repouso (AES-256-GCM); CPF exibido mascarado
  para o cliente; acesso completo só no Admin (auditado pela sessão).
- Rate limiting global e estrito em login/cadastro/recuperação de senha/contato.
- Cabeçalhos de segurança no Caddy (HSTS, CSP, nosniff, frame-ancestors) e Helmet na API.
- Erros sem detalhes internos (RFC 7807); logs sem cookies/senhas; `request_id` por requisição.
- Trilha de auditoria imutável (`audit_logs`) para ações administrativas, login e
  alterações de configuração.
- Webhook do Asaas autenticado por token e idempotente; dados de cartão nunca passam pela loja.
- Uploads validados pelos bytes, com limite de tamanho; nomes aleatórios.
- Containers sem root, rede interna, apenas 443/80 públicos; segredos em `.env` fora do
  repositório; CI com secret scanning e varredura de vulnerabilidades.
- Registro de consentimento na newsletter (`consent_at`) e no cadastro/checkout (aceite dos termos).

## Antes do go-live (decisões do negócio) ‹decidir›

- [ ] **Política de privacidade** (base legal de cada tratamento: execução de contrato para
      pedido/entrega; consentimento para newsletter; obrigação legal para nota fiscal),
      prazo de retenção e canal do encarregado (DPO).
- [ ] **Termos de compra** e **política de trocas** (CDC art. 49: 7 dias para arrependimento
      em compras online; procedimento e custos de devolução).
- [ ] Exibir **CNPJ, razão social, endereço e canais de atendimento** no rodapé
      (Decreto 7.962/2013) — campos já existem nas configurações.
- [ ] Emissão de **nota fiscal** (NF-e) por pedido: integração fora do escopo da v1 (o CPF
      já é coletado e armazenado cifrado para isso).
- [ ] Processo para **direitos do titular** (acesso, correção, exclusão): a v1 permite ao
      cliente editar dados e ao admin consultar; exclusão de conta é manual (soft delete
      em `users.deleted_at`).
- [ ] **DPA/termos** com terceiros que tratam dados: Asaas, provedor de e-mail, Correios,
      hospedagem; residência de dados preferencialmente no Brasil.
- [ ] **Cookies**: a loja usa apenas cookie de sessão (essencial) e `localStorage` para
      sacola/favoritos; se adicionar GA4/Pixel, incluir banner de consentimento.
- [ ] **Pentest** ou revisão externa antes do lançamento, e a cada mudança relevante em
      auth/pagamento.
- [ ] Rotina de rotação de segredos (API keys, `APP_ENCRYPTION_KEY` com re-cifragem) documentada.

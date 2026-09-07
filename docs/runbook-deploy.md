# Runbook — deploy, operação, backup e rollback

## 1. Servidor

- VPS Linux (Ubuntu 24.04 LTS recomendado), 2 vCPU / 4 GB é suficiente para começar.
- Instale Docker Engine + Compose plugin. Crie um usuário sem root com acesso ao Docker.
- Firewall: liberar apenas **443** e **80** (redirecionamento para HTTPS) e **22**
  restrito ao seu IP. Banco e API não expõem portas.
- DNS: registro A/AAAA do domínio (ex.: `loja.exemplo.com.br`) apontando para o VPS.

## 2. Configuração

```bash
git clone <repo> vellor && cd vellor
cp .env.example .env && chmod 600 .env
```

Preencha no `.env` (mínimo para produção):

| Variável                                                       | Observação                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `NODE_ENV=production`                                          |                                                                                    |
| `DOMAIN`, `ACME_EMAIL`                                         | domínio público e e-mail para o certificado TLS                                    |
| `APP_URL=https://<DOMAIN>`                                     | usado em e-mails e na verificação de origem                                        |
| `POSTGRES_PASSWORD`                                            | senha forte (o compose monta `DATABASE_URL`)                                       |
| `APP_ENCRYPTION_KEY`                                           | `openssl rand -base64 48` — **guarde em cofre**; perder = perder CPFs/MFA cifrados |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`                                | primeiro administrador (criado pelo seed)                                          |
| `ASAAS_API_KEY`, `ASAAS_ENV=production`, `ASAAS_WEBHOOK_TOKEN` | ver §5                                                                             |
| `SMTP_*`, `MAIL_FROM`                                          | provedor transacional (Resend, SES, Brevo…)                                        |
| `CORREIOS_*`                                                   | quando houver contrato; sem eles a tabela de contingência é usada                  |
| `SENTRY_DSN`, `METRICS_TOKEN`                                  | opcionais                                                                          |

## 3. Subir

```bash
docker compose --env-file .env -f infra/docker-compose.prod.yml up -d --build
docker compose --env-file .env -f infra/docker-compose.prod.yml logs -f api   # aguarde "ouvindo na porta"
# primeiro administrador (migrations já rodaram no boot da API)
docker compose --env-file .env -f infra/docker-compose.prod.yml exec api node dist/database/seed.js --skip-catalog
```

Acesse `https://<DOMAIN>/admin`, entre com o admin e **ative o MFA** (obrigatório).
Depois configure em _Configurações_: identidade/CNPJ/endereço, WhatsApp, frete
(CEP de origem, seguro, tabela), parcelamento e textos legais.

Verificações pós-deploy: `curl -I https://<DOMAIN>` (200), `https://<DOMAIN>/api/v1/settings`
(JSON), `docker compose ... ps` (todos `healthy`).

## 4. Atualizar (deploy contínuo)

```bash
git pull
docker compose --env-file .env -f infra/docker-compose.prod.yml up -d --build
```

A API aplica migrations pendentes ao iniciar (`RUN_MIGRATIONS=true`). O Caddy mantém o
certificado. Downtime: alguns segundos enquanto o container da API reinicia.

**Rollback**: `git checkout <tag-anterior>` e repita o comando acima. Migrations são
aditivas por padrão; se uma migration precisar ser desfeita, restaure o backup (§6).

## 5. Asaas

1. Crie a API key em _Integrações > API_ (use a conta sandbox para homologar:
   `ASAAS_ENV=sandbox`).
2. Em _Integrações > Webhooks_ cadastre `https://<DOMAIN>/api/v1/webhooks/asaas`,
   eventos de cobrança (`PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`,
   `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`), formato JSON, e defina um
   **token de acesso** — o mesmo valor vai em `ASAAS_WEBHOOK_TOKEN`.
3. Teste um pedido Pix na sandbox e confirme que o pedido muda para "Pagamento confirmado".

## 6. Backup e restauração

- O serviço `backup` faz `pg_dump -Fc` a cada 24 h no volume `backups`, mantendo
  `BACKUP_KEEP_DAYS` (14) dias. Copie para fora do servidor diariamente (ex.: `rclone`
  para um bucket com criptografia) — **teste a restauração todo mês**.
- Imagens: volume `uploads` (`docker run --rm -v vellor_uploads:/data -v $PWD:/out alpine tar czf /out/uploads.tgz /data`).

Restaurar:

```bash
docker compose --env-file .env -f infra/docker-compose.prod.yml stop api
docker compose --env-file .env -f infra/docker-compose.prod.yml exec postgres \
  sh -c 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB" /backups/<arquivo>.dump'
docker compose --env-file .env -f infra/docker-compose.prod.yml start api
```

RPO alvo: 24 h (reduza `BACKUP_INTERVAL_SECONDS` se necessário). RTO alvo: < 1 h.

## 7. Operação do dia a dia

- Logs JSON: `docker compose ... logs -f api` (campo `reqId` correlaciona requisições).
- Métricas: `curl -H "Authorization: Bearer $METRICS_TOKEN" http://api:3001/metrics` de dentro
  da rede (`docker compose ... exec web wget -qO- http://api:3001/metrics`).
- Outbox: e-mails que falharam ficam em `outbox_events` com `status = 'dead'`; corrija a
  causa (SMTP) e reenfileire com `update outbox_events set status='pending', attempts=0 where status='dead'`.
- Pedidos pendentes expiram automaticamente após 5 dias (job horário) liberando o estoque.
- Admin perdeu o MFA: outro admin não pode redefinir pela UI na v1. Com acesso ao banco:
  `update users set mfa_secret_encrypted=null, mfa_enabled_at=null where email='<email>'` e
  peça para reconfigurar no próximo login (registre a ação).

## 8. Checklist de go-live

- [ ] `.env` completo, `APP_ENCRYPTION_KEY` e senhas em cofre
- [ ] MFA ativo em todos os admins; senhas fortes
- [ ] Asaas em produção com webhook testado
- [ ] SMTP validado (e-mail de pedido chegando; SPF/DKIM do domínio)
- [ ] Textos legais, CNPJ e endereço preenchidos (ver `docs/seguranca-e-lgpd.md`)
- [ ] Catálogo real cadastrado e placeholders removidos (`seed.js --remove-placeholders`)
- [ ] Backup externo automatizado e restauração testada
- [ ] Monitoramento de erros (Sentry) e alerta de disponibilidade (uptime externo)

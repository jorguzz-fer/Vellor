# Deploy com Coolify

Guia para publicar a Vellor em um servidor gerenciado pelo [Coolify](https://coolify.io) (v4).
O Coolify faz o build das imagens a partir do repositório, cuida do certificado TLS e
reimplanta a loja a cada push na `main`. Ele usa o arquivo `docker-compose.coolify.yml` da
raiz do repositório, que sobe quatro serviços: `postgres`, `api`, `web` e `backup`.

Para deploy manual com Docker Compose (sem Coolify), veja o [runbook-deploy.md](runbook-deploy.md).

## 1. Antes de começar

- Servidor com o Coolify instalado (2 vCPU, 4 GB de RAM e 40 GB de SSD bastam para começar).
  A loja pode rodar no mesmo servidor do Coolify.
- DNS: registro A do domínio da loja (ex.: `loja.exemplo.com.br`) apontando para o IP do servidor.
- Conta no Asaas (API key e token de webhook) e um provedor SMTP (Resend, SES, Brevo…).
- Dois segredos gerados na sua máquina:

```bash
openssl rand -hex 24      # POSTGRES_PASSWORD (só hexadecimal: entra em uma URL)
openssl rand -base64 48   # APP_ENCRYPTION_KEY (guarde em cofre; perder = perder CPFs e MFA cifrados)
```

## 2. Criar o recurso

1. No Coolify: **Projects → New Project → Production → + New Resource**.
2. Escolha **GitHub App** (instale o app do Coolify na sua conta do GitHub e autorize o
   repositório). Com o app, cada push na `main` faz deploy automaticamente.
   Alternativa: **Public/Private Repository** com a URL do repositório.
3. Repositório `jorguzz-fer/Vellor`, branch `main`.
4. **Build Pack: Docker Compose**. Base Directory `/`. Docker Compose Location
   `/docker-compose.coolify.yml`. Clique em **Continue**: o Coolify lê o arquivo e mostra os
   quatro serviços.

## 3. Domínio

No serviço **web**, campo **Domains**, informe `https://loja.exemplo.com.br` e salve.
O proxy do Coolify emite o certificado sozinho no primeiro acesso. Se o proxy não detectar a
porta do container, informe o domínio com a porta interna: `https://loja.exemplo.com.br:80`.

Os serviços `postgres`, `api` e `backup` não recebem domínio: ficam acessíveis só pela rede
interna. Toda a API é servida pelo `web` em `/api/*` e `/uploads/*`.

## 4. Variáveis de ambiente

Aba **Environment Variables**. O Coolify já lista as variáveis usadas pelo compose; preencha:

| Variável                                                         | Valor                                                      |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| `APP_URL`                                                        | `https://loja.exemplo.com.br` (obrigatória)                |
| `POSTGRES_PASSWORD`                                              | o hexadecimal gerado acima (obrigatória)                   |
| `APP_ENCRYPTION_KEY`                                             | a chave gerada acima (obrigatória, mínimo 32 caracteres)   |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`                    | primeiro administrador; senha com 10+ caracteres           |
| `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_ENV`              | `sandbox` para homologar, `production` para vender         |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`  | provedor de e-mail transacional                            |
| `CORREIOS_USER`, `CORREIOS_ACCESS_CODE`, `CORREIOS_POSTAGE_CARD` | só quando houver contrato; sem eles vale a tabela do Admin |
| `ACME_EMAIL`, `SENTRY_DSN`, `METRICS_TOKEN`, `S3_*`, `LOG_LEVEL` | opcionais                                                  |

Para homologar sem conta no Asaas, defina `PAYMENTS_MOCK=true` (pedidos com pagamento
simulado). Nunca deixe isso ligado em produção. Variáveis opcionais podem ficar vazias.

## 5. Deploy

Clique em **Deploy** e acompanhe em **Logs**. O primeiro build leva alguns minutos (duas
imagens). Na inicialização a API aplica as migrations, grava as configurações padrão e cria
o administrador de `ADMIN_EMAIL` caso ele ainda não exista. Não há comando manual.

Pronto quando `https://loja.exemplo.com.br` abre a loja e
`https://loja.exemplo.com.br/api/v1/settings` responde JSON.

## 6. Primeiro acesso

1. Abra `https://loja.exemplo.com.br/admin`, entre com `ADMIN_EMAIL` e `ADMIN_PASSWORD` e
   **ative o MFA** (obrigatório).
2. Apague `ADMIN_PASSWORD` das variáveis do Coolify: a senha já está gravada no banco e a
   variável só serve para criar o primeiro administrador.
3. Em **Configurações** preencha identidade, CNPJ, endereço, WhatsApp, frete (CEP de origem,
   seguro, tabela de contingência), parcelamento e os textos legais marcados com `‹decidir›`.
4. No Asaas, em _Integrações > Webhooks_, cadastre `https://loja.exemplo.com.br/api/v1/webhooks/asaas`
   com os eventos de cobrança (`PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`,
   `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`) e o mesmo token de `ASAAS_WEBHOOK_TOKEN`.
   Faça um pedido Pix de teste e confira que ele muda para "Pagamento confirmado".
5. Cadastre o catálogo real (ver [catalogo.md](catalogo.md)). Em produção a loja começa
   vazia. Para ver a loja com o catálogo de demonstração, abra **Terminal** no menu do
   Coolify, escolha o container `api` e rode `node dist/database/seed.js --with-catalog`;
   para remover os produtos de demonstração depois, `node dist/database/seed.js --remove-placeholders`.

## 7. Atualizações e rollback

- Com o GitHub App, todo push na `main` gera um novo deploy. Sem ele, use **Redeploy**.
- A API reaplica migrations pendentes ao subir; o Caddy e o proxy mantêm o certificado.
- Rollback: em **Deployments**, escolha um deploy anterior e reimplante. Migrations são
  aditivas por padrão; se precisar desfazer uma, restaure o backup (abaixo).

## 8. Backup e restauração

O serviço `backup` faz `pg_dump -Fc` a cada 24 h no volume `backups`, mantendo
`BACKUP_KEEP_DAYS` (14) dias. Copie os dumps para fora do servidor todos os dias, por exemplo
com `rclone` para um bucket; teste a restauração todo mês. As imagens dos produtos ficam no
volume `uploads` (ou no S3/R2, se `STORAGE_DRIVER=s3`).

Restaurar (via **Terminal** do Coolify ou SSH no servidor):

```bash
docker exec -i <container postgres> pg_restore --clean --if-exists -U vellor -d vellor < <arquivo>.dump
```

Alternativa: criar um **PostgreSQL gerenciado pelo Coolify** (Databases → PostgreSQL), que
tem backup agendado para S3 na própria interface. Nesse caso defina `DATABASE_URL` nas
variáveis com a URL interna que o Coolify mostra e remova os serviços `postgres` e `backup`
do compose.

## 9. Problemas comuns

- **Build falha por falta de memória**: use 4 GB ou ative swap no servidor.
- **`defina POSTGRES_PASSWORD` ou `defina APP_URL` nos logs**: variável obrigatória vazia.
- **A loja abre mas `/api` responde 502**: veja os logs do `api`; quase sempre é uma variável
  obrigatória faltando (`APP_ENCRYPTION_KEY`, `ASAAS_API_KEY` sem `PAYMENTS_MOCK`).
- **Certificado não emitido**: o DNS ainda não propagou ou as portas 80/443 estão fechadas
  no firewall do servidor.
- **Domínio salvo mas página em branco no proxy**: informe a porta no domínio (`:80`).

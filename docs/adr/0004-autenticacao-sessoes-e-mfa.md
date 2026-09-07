# ADR 0004 — Autenticação por sessão server-side, cookie httpOnly e MFA obrigatório no admin

- Status: aceito
- Data: 2026-09-07

## Contexto

O blueprint exige auth 100% no servidor, sessão em cookie httpOnly, Argon2id, MFA para
papéis sensíveis, lockout progressivo e auditoria. A loja e o admin são a mesma SPA,
servida na mesma origem da API (Caddy), o que simplifica cookies e CSRF.

## Decisão

- **Sessões no PostgreSQL** (`sessions`): o cookie `vellor_sid` carrega só um token opaco
  (32 bytes aleatórios); o banco guarda o SHA-256. `httpOnly`, `Secure` (produção),
  `SameSite=Lax`. Clientes: 30 dias; admins: 12 horas. Logout revoga; troca/redefinição
  de senha revoga todas as outras sessões.
- **Senhas** com Argon2id (19 MiB, 2 iterações) via `@node-rs/argon2`; verificação com
  tempo constante mesmo para e-mails inexistentes.
- **Lockout**: 5 falhas bloqueiam por 15 min, dobrando a cada falha seguinte (máx. 24 h).
- **MFA TOTP** (RFC 6238, `otplib`) obrigatório para `admin`: o painel só abre com
  `mfa_verified` na sessão; o segredo fica criptografado (AES-256-GCM com
  `APP_ENCRYPTION_KEY`). Clientes não usam MFA na v1.
- **CSRF**: `SameSite=Lax` + guarda global que exige `Origin` permitida em requisições
  mutáveis (webhooks são explicitamente isentos).
- **Rate limiting** global (120/min por IP) e estrito nos endpoints de auth (5–10/min).
- **RBAC** simples (`customer`, `admin`) com guards; autorização por objeto nos pedidos
  (dono, token de acesso do visitante ou admin).
- Dados sensíveis (CPF, segredo MFA) criptografados em repouso; CPF só é
  descriptografado para emitir cobrança e para o admin.
- Toda ação relevante gera registro em `audit_logs` (ator, ação, entidade, IP).

## Consequências

- Uma instância só (sem Redis) basta para a v1; sessões e rate limit em memória por
  processo são aceitáveis. Ao escalar horizontalmente, mover o throttler para Redis.
- Recuperação de MFA perdido é operacional (outro admin ou intervenção no banco);
  documentado no runbook.

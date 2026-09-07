# ADR 0006 — Imagens de produto em disco local (volume) com driver S3-compatível opcional

- Status: aceito
- Data: 2026-09-07

## Contexto

O catálogo é pequeno (dezenas a centenas de SKUs) e o deploy é um VPS único. O blueprint
recomenda object storage S3-compatível (R2, sem egress), mas o MinIO self-hosted perdeu
suporte da comunidade e adicionaria um serviço à operação.

## Decisão

- `StorageService` com dois drivers escolhidos por `STORAGE_DRIVER`:
  - `local` (padrão): arquivos em `/data/uploads` (volume Docker), servidos em `/uploads/*`
    pela API com cache longo, atrás do Caddy.
  - `s3`: qualquer S3-compatível (Cloudflare R2, AWS S3, Backblaze B2) via AWS SDK, URL
    pública configurável (`S3_PUBLIC_URL`/CDN).
- Validação do arquivo pelos **bytes** (JPEG, PNG, WEBP, AVIF, GIF), limite de 8 MB,
  nomes aleatórios (UUID) por produto.
- Sem processamento de imagem na v1 (sem `sharp`): o Admin deve enviar imagens já
  otimizadas (ver guia do catálogo).

## Consequências

- Backup das imagens = backup do volume `uploads` (documentado no runbook).
- Para CDN/escala, basta trocar `STORAGE_DRIVER=s3` e migrar os arquivos.
- Geração de miniaturas/WebP pode ser adicionada depois (worker no outbox).

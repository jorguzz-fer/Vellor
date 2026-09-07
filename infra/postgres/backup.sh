#!/bin/sh
# Backup periódico do PostgreSQL (pg_dump -Fc) com retenção por dias.
# Restauração: pg_restore --clean --if-exists -d "$PGDATABASE" /backups/<arquivo>.dump
set -eu

KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
mkdir -p /backups

while true; do
  STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
  FILE="/backups/${PGDATABASE}-${STAMP}.dump"
  if pg_dump -Fc -f "$FILE.tmp"; then
    mv "$FILE.tmp" "$FILE"
    echo "[backup] ok: $FILE ($(du -h "$FILE" | cut -f1))"
    find /backups -name "${PGDATABASE}-*.dump" -type f -mtime +"$KEEP_DAYS" -delete
  else
    echo "[backup] FALHA em $STAMP" >&2
    rm -f "$FILE.tmp"
  fi
  sleep "$INTERVAL"
done

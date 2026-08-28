#!/usr/bin/env bash
# Backup semanal do Postgres (pelada-db) na VM Oracle.
# Instalação na VM: ver backend/scripts/README-backup.md
set -euo pipefail

BACKUP_DIR="${PELADA_BACKUP_DIR:-/home/ubuntu/pelada/backups}"
LOG_FILE="${PELADA_BACKUP_LOG:-$BACKUP_DIR/backup.log}"
DBPASS_FILE="${PELADA_DBPASS_FILE:-/home/ubuntu/pelada/.dbpass}"
CONTAINER="${PELADA_DB_CONTAINER:-pelada-db}"
DB_USER="${PELADA_DB_USER:-pelada}"
DB_NAME="${PELADA_DB_NAME:-pelada_oficial}"
KEEP="${PELADA_BACKUP_KEEP:-8}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

log() {
  echo "$(date -Is) $*" >> "$LOG_FILE"
}

if [[ ! -f "$DBPASS_FILE" ]]; then
  log "ERRO: arquivo de senha não encontrado ($DBPASS_FILE)"
  exit 1
fi

PGPASSWORD=$(tr -d '\n' < "$DBPASS_FILE")
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/pelada_oficial-${STAMP}.sql.gz"
TMP="$OUT.partial"

if docker exec -e PGPASSWORD="$PGPASSWORD" "$CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl | gzip > "$TMP"; then
  mv "$TMP" "$OUT"
  SIZE=$(du -h "$OUT" | cut -f1)
  log "OK: $OUT ($SIZE)"
else
  rm -f "$TMP"
  log "ERRO: pg_dump falhou"
  exit 1
fi

mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/pelada_oficial-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) || true)
for f in "${OLD[@]}"; do
  rm -f "$f"
  log "removido backup antigo: $f"
done

unset PGPASSWORD

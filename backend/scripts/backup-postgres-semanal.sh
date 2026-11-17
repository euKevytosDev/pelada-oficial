#!/usr/bin/env bash
# Backup semanal do Postgres de PRODUÇÃO (Supabase via spring.env na VM Oracle).
# Instalação na VM: ver backend/scripts/README-backup.md
set -euo pipefail

BACKUP_DIR="${PELADA_BACKUP_DIR:-/home/ubuntu/pelada/backups}"
LOG_FILE="${PELADA_BACKUP_LOG:-$BACKUP_DIR/backup.log}"
SPRING_ENV="${PELADA_SPRING_ENV:-/home/ubuntu/pelada/spring.env}"
KEEP="${PELADA_BACKUP_KEEP:-8}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

log() {
  echo "$(date -Is) $*" >> "$LOG_FILE"
}

if [[ ! -f "$SPRING_ENV" ]]; then
  log "ERRO: spring.env não encontrado ($SPRING_ENV)"
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$SPRING_ENV"
set +a

if [[ -z "${SPRING_DATASOURCE_URL:-}" || -z "${SPRING_DATASOURCE_USERNAME:-}" || -z "${SPRING_DATASOURCE_PASSWORD:-}" ]]; then
  log "ERRO: credenciais SPRING_DATASOURCE_* ausentes em $SPRING_ENV"
  exit 1
fi

# jdbc:postgresql://host:port/db?params  → host / port / db
JDBC="${SPRING_DATASOURCE_URL#jdbc:postgresql://}"
HOSTPORT="${JDBC%%/*}"
DB_AND_QS="${JDBC#*/}"
DB_NAME="${DB_AND_QS%%\?*}"
DB_HOST="${HOSTPORT%%:*}"
DB_PORT="${HOSTPORT##*:}"
if [[ "$DB_PORT" == "$DB_HOST" ]]; then
  DB_PORT=5432
fi
DB_NAME="${DB_NAME:-postgres}"

STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/pelada_oficial-${STAMP}.sql.gz"
TMP="$OUT.partial"

export PGPASSWORD="$SPRING_DATASOURCE_PASSWORD"

# Supabase está em Postgres 17 — pg_dump precisa da mesma major.
PG_DUMP_IMAGE="${PELADA_PG_DUMP_IMAGE:-postgres:17-alpine}"

if docker run --rm --network host \
  -e PGPASSWORD \
  "$PG_DUMP_IMAGE" \
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$SPRING_DATASOURCE_USERNAME" -d "$DB_NAME" \
    --no-owner --no-acl | gzip > "$TMP"; then
  mv "$TMP" "$OUT"
  SIZE=$(du -h "$OUT" | cut -f1)
  log "OK: $OUT ($SIZE) host=$DB_HOST db=$DB_NAME"
else
  rm -f "$TMP"
  log "ERRO: pg_dump falhou (host=$DB_HOST db=$DB_NAME)"
  unset PGPASSWORD
  exit 1
fi

unset PGPASSWORD

mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/pelada_oficial-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) || true)
for f in "${OLD[@]}"; do
  rm -f "$f"
  log "removido backup antigo: $f"
done

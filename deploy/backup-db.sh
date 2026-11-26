#!/usr/bin/env bash
set -euo pipefail

# Automated PostgreSQL backup script for LexiFlow.
# Example cron entry (runs daily at 03:30):
#   30 3 * * * /var/www/lexiflow/deploy/backup-db.sh >> /var/log/lexiflow-backup.log 2>&1
#
# Restore command example:
#   gunzip -c /var/backups/lexiflow/lexiflow_YYYYMMDD_HHMMSS.sql.gz | docker exec -i lexiflow-postgres psql -U lexiflow lexiflow

CONTAINER_NAME="${CONTAINER_NAME:-lexiflow-postgres}"
POSTGRES_USER="${POSTGRES_USER:-lexiflow}"
POSTGRES_DB="${POSTGRES_DB:-lexiflow}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/lexiflow}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$BACKUP_DIR/lexiflow_${TIMESTAMP}.sql.gz"

echo "[$(date -Iseconds)] Starting PostgreSQL backup -> $OUT_FILE"
docker exec "$CONTAINER_NAME" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$OUT_FILE"

if [ ! -s "$OUT_FILE" ]; then
  echo "ERROR: Backup file is empty!"
  rm -f "$OUT_FILE"
  exit 1
fi

find "$BACKUP_DIR" -name "lexiflow_*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -delete
echo "[$(date -Iseconds)] Backup completed cleanly. Retained last $RETENTION_DAYS days."

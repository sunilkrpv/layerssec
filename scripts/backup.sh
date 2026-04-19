#!/bin/bash
# Layers — PostgreSQL backup script
# Runs inside the postgres container via docker compose exec.
# Intended for daily cron: 0 2 * * * ~/layers/layers-rest/scripts/backup.sh
#
# Env overrides:
#   BACKUP_DIR   — where to store .sql.gz files (default: ~/layers/backups)
#   COMPOSE_FILE — path to docker-compose.yml (default: ~/layers/layers-rest/docker-compose.yml)
#   RETAIN_DAYS  — how many days of backups to keep (default: 30)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/layers/backups}"
COMPOSE_FILE="${COMPOSE_FILE:-$HOME/layers/layers-rest/docker-compose.yml}"
RETAIN_DAYS="${RETAIN_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTFILE="$BACKUP_DIR/db_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting dump → $OUTFILE"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U layers layers \
  | gzip > "$OUTFILE"

echo "[backup] Dump complete ($(du -sh "$OUTFILE" | cut -f1))"

# Remove backups older than RETAIN_DAYS
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +"$RETAIN_DAYS" -delete
echo "[backup] Pruned backups older than ${RETAIN_DAYS} days"

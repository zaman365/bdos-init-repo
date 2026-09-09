#!/usr/bin/env bash
# Rebuild a local BDOS database from scratch and run every migration in order.
#   ./db/apply.sh [dbname]
set -euo pipefail
DB="${1:-bdos_dev}"
HERE="$(cd "$(dirname "$0")" && pwd)"

dropdb --if-exists "$DB"
createdb "$DB"
for f in "$HERE"/migrations/*.sql; do
  printf '  applying %s\n' "$(basename "$f")"
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done
echo "  ok: $DB rebuilt"

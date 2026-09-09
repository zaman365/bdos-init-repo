#!/usr/bin/env bash
# Rebuild a local BDOS database from scratch and run every migration in order.
#   ./db/apply.sh [dbname]
set -euo pipefail
RESET=false
if [[ "${1:-}" == "--reset" ]]; then RESET=true; shift; fi
DB="${1:-bdos_dev}"
if [[ ! "$DB" =~ ^bdos_[a-zA-Z0-9_]+$ ]]; then
  echo "Use a dedicated bdos_* database name." >&2; exit 2
fi
HERE="$(cd "$(dirname "$0")" && pwd)"

# Reset is opt-in. With no flag, createdb refuses an existing database.
if [[ "$RESET" == true ]]; then dropdb --if-exists "$DB"; fi
createdb "$DB"
for f in "$HERE"/migrations/*.sql; do
  printf '  applying %s\n' "$(basename "$f")"
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done
echo "  ok: $DB rebuilt"

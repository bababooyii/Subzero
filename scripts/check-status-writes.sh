#!/usr/bin/env bash
# Engineering rule 2: status changes only go through src/server/state-machine.
# Invoice creation may insert `status: "draft"` in src/server/billing/insert-invoice.ts.
set -u
cd "$(dirname "$0")/.."

dirs=()
for d in src/features src/server; do [ -d "$d" ] && dirs+=("$d"); done
[ ${#dirs[@]} -eq 0 ] && { echo "OK: no status writes outside the state machine."; exit 0; }

hits=$(grep -rnE "status:\s" "${dirs[@]}" --include=*.ts \
  | grep -v "^src/server/state-machine/" \
  | grep -v "^src/server/billing/insert-invoice.ts:" \
  | grep -vE "\.test\.ts:" || true)

if [ -n "$hits" ]; then
  echo "Status writes found outside src/server/state-machine:"
  echo "$hits"
  exit 1
fi
echo "OK: no status writes outside the state machine."

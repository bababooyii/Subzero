#!/usr/bin/env bash
# Sync this checkout into the team Codespace and run checks there (local installs are too slow on this network).
# Usage: scripts/cs-check.sh <lane> [command...]
#   lane     a short name; each lane gets its own copy (/workspaces/ui-<lane>) sharing /workspaces/ui/node_modules,
#            so parallel agents don't clobber each other.
#   command  defaults to: tsc + eslint (on the whole tree). Examples:
#            scripts/cs-check.sh subs "pnpm vitest run src/features/subscriptions"
set -euo pipefail
CS=subzero-ci-5g7x7x94jq5hv95w
LANE=${1:?lane name required}; shift || true
CMD=${*:-"npx next typegen >/dev/null && npx tsc --noEmit --incremental false && npx eslint src"}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
DEST=/workspaces/ui-$LANE
COPYFILE_DISABLE=1 tar --no-mac-metadata --no-xattrs -C "$ROOT" --exclude=./node_modules --exclude=./.next --exclude=./.git --exclude=./package-lock.json -czf - . \
  | gh codespace ssh -c "$CS" -- "mkdir -p $DEST && cd $DEST && find . -mindepth 1 -maxdepth 1 ! -name node_modules ! -name .next ! -name .env -exec rm -rf {} + && tar --warning=no-unknown-keyword -xzf - && ln -sfn /workspaces/ui/node_modules node_modules && cp -n /workspaces/ui/.env .env 2>/dev/null || true"
gh codespace ssh -c "$CS" -- "cd $DEST && $CMD"

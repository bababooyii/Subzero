#!/usr/bin/env bash
# Sync this checkout into /workspaces/ui in the team Codespace, where `next dev -p 3210` runs against subzero_demo.
# Forward it locally with: gh codespace ports forward 3210:3100 -c subzero-ci-5g7x7x94jq5hv95w
set -euo pipefail
CS=subzero-ci-5g7x7x94jq5hv95w
ROOT=$(cd "$(dirname "$0")/.." && pwd)
COPYFILE_DISABLE=1 tar --no-mac-metadata --no-xattrs -C "$ROOT" --exclude=./node_modules --exclude=./.next --exclude=./.git --exclude=./package-lock.json -czf - . \
  | gh codespace ssh -c "$CS" -- "cd /workspaces/ui && tar --warning=no-unknown-keyword -xzf -"

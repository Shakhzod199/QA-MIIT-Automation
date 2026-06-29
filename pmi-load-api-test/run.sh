#!/usr/bin/env bash
# Runs a k6 test from this folder with credentials loaded from ../.env.local.
# Usage: ./run.sh load    (or: ./run.sh stress)
set -euo pipefail
cd "$(dirname "$0")"

kind="${1:-load}"
case "$kind" in
  load) script="load-test.js" ;;
  stress) script="stress-test.js" ;;
  *) echo "Usage: $0 [load|stress]" >&2; exit 1 ;;
esac

env_file="../.env.local"
if [ -f "$env_file" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
fi

k6 run "$script"

#!/usr/bin/env bash
# SessionStart hook: prime the workspace so the crew is ready instantly —
# mainly for Claude Code on the web, where containers start without node_modules.
# Local sessions with deps already installed are a fast no-op.
set -uo pipefail

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$project_dir" || exit 0

# Only act in this project (it has the content-layer validator).
[ -f package.json ] && grep -q '"validate:content"' package.json || exit 0

if [ ! -d node_modules ]; then
  echo "brand-crew: installing dependencies (first run in this container)…" >&2
  pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install >/dev/null 2>&1 || true
fi

exit 0

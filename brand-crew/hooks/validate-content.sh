#!/usr/bin/env bash
# PostToolUse hook: after an Edit/Write/MultiEdit, if the touched file lives under
# content/ or data/, run the content validator so a broken frontmatter / data edit
# fails loudly before it can be committed. Reads the hook event JSON from stdin.
#
# Exit 2 + stderr feeds the failure back to Claude so it can fix it; exit 0 is a no-op.
set -euo pipefail

input="$(cat)"

# Extract the edited file path from the tool input without requiring jq.
# `|| true` guards the no-match case — under pipefail a grep miss would
# otherwise abort the whole script with exit 1 before the no-op case below.
path="$(printf '%s' "$input" | { grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' || true; } | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//; s/"$//')"

# No path, or not a content/data edit → nothing to validate.
case "$path" in
  */content/*|*/data/*|content/*|data/*) ;;
  *) exit 0 ;;
esac

# The hook runs from the project root (CLAUDE_PROJECT_DIR). Validate content there.
project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$project_dir"

if ! out="$(pnpm validate:content 2>&1)"; then
  echo "content validation failed after editing ${path}:" >&2
  echo "$out" >&2
  exit 2
fi

exit 0

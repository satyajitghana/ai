---
description: Write a dated daily build-log entry.
argument-hint: [braindump | "from git"]
---

Use the **new-log** skill to write today's log from: $ARGUMENTS

If "from git", summarize recent commits. Write `content/logs/<today>-<slug>.mdx`, then run `pnpm validate`. Ship via PR.

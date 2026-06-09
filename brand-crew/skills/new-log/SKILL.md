---
name: new-log
description: Write a dated daily build-log entry for ai.thesatyajit.com. Use when Satyajit gives a braindump, a sentence about what he did today, or says "log from git". Creates content/logs/YYYY-MM-DD-slug.mdx with valid frontmatter, then runs pnpm validate.
---

# new-log — author a daily log

Create `content/logs/<YYYY-MM-DD>-<slug>.mdx`. The date prefix is today; `<slug>` is a short kebab-case summary (e.g. `2026-06-04-cuda-grouping-kernel.mdx`). The whole filename is the URL slug.

## Frontmatter (Zod: `logFrontmatter`)
```yaml
---
title: Short summary of the day   # optional but recommended
date: 2026-06-04                   # today, must match the date in the filename
tags: [build-log]                 # kebab-case
---
```

## Body
- MDX, short and conversational but precise — what happened, what shipped, what's next. Read `brand-crew/brand/voice.md`; no marketing fluff.
- "From git": summarize recent commits (`git log --oneline -20`) into a coherent narrative, don't just list them.

## Steps
1. Build the filename `content/logs/<today>-<slug>.mdx`; confirm it doesn't exist.
2. Write frontmatter (date = today) + body.
3. Run `pnpm validate` and report. Fix Zod errors and re-run until green.
4. Ship via PR.

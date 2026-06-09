---
description: Build the daily arXiv paper digest.
argument-hint: [date | arxiv-id]
---

Use the **add-papers-digest** skill (args: $ARGUMENTS) — the **paper-scout** flow.

Run `pnpm tsx scripts/fetch-arxiv.mts`, curate the top ~5–10, write a personal take per paper, save `content/arxiv/<date>.mdx`, then run `pnpm validate`. Links only, no PDFs. Ship via PR.

---
description: Recheck Satyajit's X reposts and write up what is new.
argument-hint: [go | triage-only | --all]
---

Use the **recheck-reposts** skill (args: $ARGUMENTS).

1. Run `pnpm reposts`. It lists only posts not already in `data/reposts-ledger.json`.
2. Triage each post: new article, update, roundup, covered, or skip. Find the primary source for each.
3. Record every decision with `pnpm reposts record …`.
4. Show the triage. Unless the argument is `go`, wait for Satyajit before writing.
5. Write the articles, in parallel authors for a batch.
6. Review the authors' work, merge it, fetch cards and render thumbnails.
7. Run `pnpm validate` and `pnpm build`, then ship via PR.

If the argument is `triage-only`, stop after step 4.

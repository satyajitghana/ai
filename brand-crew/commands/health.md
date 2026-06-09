---
description: Update the biomarker dashboard from a lab panel.
argument-hint: [lab.pdf | results]
---

Use the **update-health** skill to ingest: $ARGUMENTS

Map each value into `data/health.ts` (category, unit, optimalRange), sanity-check statuses, then run `pnpm validate`. Don't store the source PDF. Ship via PR.

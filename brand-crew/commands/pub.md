---
description: Add a publication or patent record.
argument-hint: [DOI | arxiv-id | filing-receipt]
---

Add a research record from: $ARGUMENTS

- DOI / arXiv paper → **add-publication** (`data/publications.ts`)
- USPTO filing receipt → **add-patent** (`data/patents.ts`)

Resolve metadata, append the entry, then run `pnpm validate`. Ship via PR.

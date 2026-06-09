---
name: add-papers-digest
description: Build the daily arXiv paper digest for ai.thesatyajit.com. Use when Satyajit wants today's (or a given date's) personalized arXiv digest, "the papers", says "/arxiv", or asks the paper-scout to run. Runs scripts/fetch-arxiv.mts, curates the top candidates, writes a personal take per paper, and saves content/arxiv/YYYY-MM-DD.mdx, then runs pnpm validate.
---

# add-papers-digest — daily arXiv digest

Create `content/arxiv/<YYYY-MM-DD>.mdx` where the filename **is** the date (validator enforces `slug === date`). One digest per day. Route: `/arxiv`.

## Steps
1. Fetch candidates (no PDFs stored — links are derived from arxivId):
   ```
   pnpm tsx scripts/fetch-arxiv.mts
   ```
   This prints the top 15 scored candidates as JSON (`arxivId,title,authors,categories,abstract,score,published`), ranked against `data/interests.ts`.
2. Curate the best ~5–10 (respect `interests.maxPapersPerDay`). Read the abstract (and the abs/HTML page if needed) and write a 1–3 sentence **take** per paper in Satyajit's voice (`brand-crew/brand/voice.md`) — why it matters to his work (3D/LiDAR/CUDA/DL systems).
3. Set `standout: true` on any genuinely exciting "crazy paper" (amplify/blog candidate).
4. Write `content/arxiv/<date>.mdx`:

```yaml
---
date: 2026-06-04
papers:
  - arxivId: "2606.05162v1"        # must match \d{4}\.\d{4,5}(vN)?
    title: "…"
    authors: [First Last, …]        # at least one
    categories: [cs.CV]
    abstract: >-
      …
    take: >-
      Personal 1–3 sentence take.
    standout: false
---
```
(Zod: `papersDigestFrontmatter`; needs ≥1 paper.)

5. Run `pnpm validate` and report; fix errors until green. Ship via PR. Never store PDFs.

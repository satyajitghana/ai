---
name: add-reading
description: Add or update an entry on the /reading page of ai.thesatyajit.com (papers and books queued, reading, or read). Use when Satyajit shares a paper/book link, arXiv id, or DOI to track, or wants to move an item's status. Edits data/reading.ts, then runs pnpm validate.
---

# add-reading — edit the /reading list

Edit `data/reading.ts` (typed `ReadingItem[]`). Feeds the `/reading` page.

## Shape
```ts
{
  type: "paper" | "book",
  title: "…",                       // required
  author: "…",                      // optional
  url: "https://…",                 // optional — arXiv abs / DOI / book link
  status: "reading" | "read" | "queued",
  note: "1-line personal take",     // optional but encouraged
}
```

## Steps
1. Read `data/reading.ts`. For a new item, prepend/insert it; for a status change, edit the existing entry's `status`.
2. From an arXiv id or DOI, resolve the title/authors (web/`gh`) and set `url` to the abs/DOI page. Write a 1-line take in Satyajit's voice (`brand-crew/brand/voice.md`).
3. Run `pnpm validate` (typecheck) and report; fix until green. Ship via PR.

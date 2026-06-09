---
name: add-publication
description: Add a peer-reviewed publication to ai.thesatyajit.com from a DOI or arXiv id. Use when Satyajit has a new paper to list on /publications. Resolves metadata, appends to data/publications.ts, then runs pnpm validate.
---

# add-publication — add a publication record

Edit `data/publications.ts` (typed `Publication[]`). Feeds `/publications`, `/api/publications`, and JSON-LD.

## Shape
```ts
{
  title: "…",
  journal: "…",
  volume: 17,
  issue: 11,
  pages: "4952–4956",
  year: 2020,
  doi: "10.1166/…",
  authors: ["Satyajit Ghana", "…"],
  url: "https://doi.org/10.1166/…",
}
```

## Steps
1. From the DOI/arXiv id, resolve the metadata (e.g. `https://api.crossref.org/works/<doi>`, or the arXiv abs page). Fill every field; `url` should be the DOI resolver link.
2. Read `data/publications.ts` and append the new entry to the array.
3. Run `pnpm validate` (typecheck) and report; fix until green. Ship via PR.

> For a **patent** (USPTO filing receipt), use the `add-patent` skill instead.

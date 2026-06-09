---
name: add-patent
description: Add a USPTO patent application ("Patent Pending") to ai.thesatyajit.com from a filing receipt. Use when Satyajit has a new patent filing to list on /patents. Appends to data/patents.ts, then runs pnpm validate.
---

# add-patent — add a patent record

Edit `data/patents.ts` (typed `Patent[]`). Feeds `/patents`, `/api/patents`, and JSON-LD. Status is real: filed, pending examination.

## Shape
```ts
{
  title: "…",
  status: "pending",
  applicationNumber: "19/634,310",   // US application no.
  filingDate: "2026-03-31",          // YYYY-MM-DD
  confirmationNumber: "…",
  docket: "…",
  inventors: ["…", "Satyajit Ghana", "…"],
  assignee: "Inkers Technology Private Limited",
  priority: { country: "IN", number: "…", date: "YYYY-MM-DD" },
  claims: { total: 18, independent: 1 },
}
```

## Steps
1. Pull every field from the filing receipt. Dates are `YYYY-MM-DD`.
2. Read `data/patents.ts` and append the new entry.
3. Run `pnpm validate` (typecheck) and report; fix until green. Ship via PR.

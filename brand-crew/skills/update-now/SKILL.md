---
name: update-now
description: Update the /now page on ai.thesatyajit.com — what Satyajit is currently focused on. Use when he says "I'm now working on X" or wants to refresh his now-list. Edits data/now.ts and bumps `updated`, then runs pnpm validate.
---

# update-now — edit the /now page

Edit `data/now.ts` (typed `Now` record). Feeds the `/now` page.

## Shape
```ts
export const now: Now = {
  updated: "2026-06-04",   // bump to today on every change (YYYY-MM-DD)
  items: [
    "Each item is one sentence — what he's actively focused on.",
    // …keep 3–6 current items; remove stale ones.
  ],
}
```

## Steps
1. Read `data/now.ts`. Add/replace/remove items per the request; keep them concrete and current.
2. Set `updated` to today (2026-06-04).
3. Run `pnpm validate` (typecheck catches shape errors) and report; fix until green. Ship via PR.

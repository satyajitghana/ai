---
name: update-uses
description: Update the /uses page on ai.thesatyajit.com — gear, editor, and stack Satyajit reaches for. Use when he gets new hardware/software or wants to correct his setup. Edits data/uses.ts, then runs pnpm validate.
---

# update-uses — edit the /uses page

Edit `data/uses.ts` (typed `UsesSection[]`). Feeds the `/uses` page.

## Shape
```ts
export const uses: UsesSection[] = [
  {
    section: "Workstation",            // e.g. Workstation, Editor, Stack, Hardware
    items: [
      { name: "Item name", note: "optional short note" },
    ],
  },
]
```

## Steps
1. Read `data/uses.ts`. Add/edit items in the right section (create a section if needed).
2. Replace any `PLACEHOLDER` notes with confirmed details; drop the PLACEHOLDER marker once verified.
3. Run `pnpm validate` (typecheck) and report; fix until green. Ship via PR.

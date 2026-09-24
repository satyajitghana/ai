---
description: Write or refresh an article's Receipts film.
argument-hint: <article slug> [--social]
---

Use the **receipt-films** skill for: $ARGUMENTS

Write or update `data/films/<slug>.json` from the article's own text — every number and quote must be in the article — then `pnpm validate:films --storyboards --only=<slug>`, look at a contact sheet, and render with `node brand-crew/skills/receipt-films/build.mjs <slug>`. With `--social`, also render the 1280x720 cut into `drafts/films/` for /amplify. Finish with `pnpm validate`.

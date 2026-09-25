---
description: Write or refresh an article's explainer film and thumbnail.
argument-hint: <article slug> [--social]
---

Use the **explainer-films** skill for: $ARGUMENTS

Read the article, find the mechanism it explains, and write or update `data/films/<slug>.json`: an explainer — title, the one new idea, a diagram / stack / steps / grid / equation / compare of how it works, at most two number scenes, one takeaway, the recap — presented by the article's own mascot, in one of the seven styles. Every number and quote must be in the article. Then `pnpm validate:films --storyboards --only=<slug>`, look at a contact sheet (`render.mjs sheet`), render the thumbnail with `node brand-crew/skills/explainer-films/build.mjs --thumbs <slug>` and, for a filmed article, the film with `build.mjs <slug>`. With `--social`, also render the 1280x720 cut into `drafts/films/` for /amplify. Finish with `pnpm validate`.

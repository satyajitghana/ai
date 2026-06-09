---
description: Update profile pages — now / uses.
argument-hint: [change]
---

Route this profile change to the right skill: $ARGUMENTS

- "now working on / focused on" → **update-now** (`data/now.ts`, bump `updated`)
- gear / editor / stack → **update-uses** (`data/uses.ts`)

Then run `pnpm validate`. Ship via PR. (For resume edits, hand off to the profile-keeper agent in `brand-crew/agents`.)

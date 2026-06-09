---
description: Refresh GitHub seed stats in the profile.
argument-hint: 
---

Use the **refresh-seed-stats** skill (args: $ARGUMENTS).

Run `pnpm tsx brand-crew/skills/refresh-seed-stats/scripts/fetch-github-stats.mts`, update `profile.seedStats` in `data/profile.ts`, then run `pnpm validate`. Don't touch `data/.generated/*`. Ship via PR.

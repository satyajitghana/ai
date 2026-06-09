---
name: refresh-seed-stats
description: Refresh the GitHub seed stats (repos/stars/followers) baked into data/profile.ts for ai.thesatyajit.com. Use when Satyajit says "refresh stats" or on the nightly stats-refresher routine. Fetches live counts and updates profile.seedStats, then runs pnpm validate.
---

# refresh-seed-stats — refresh GitHub seed stats

Update `profile.seedStats` in `data/profile.ts`. These are the build-time fallback counts; live numbers come from `lib/github.ts` at runtime.

## Steps
1. Fetch fresh counts (set `GITHUB_TOKEN` to avoid rate limits):
   ```
   pnpm tsx brand-crew/skills/refresh-seed-stats/scripts/fetch-github-stats.mts
   ```
   Prints `{ repos, stars, followers }` for the handle in `data/profile.ts`.
2. Read `data/profile.ts` and update the `seedStats` object with those numbers:
   ```ts
   seedStats: { repos: <n>, stars: <n>, followers: <n> },
   ```
3. Run `pnpm validate` (typecheck) and report; fix until green. Ship via PR.

> Don't touch `data/.generated/*` — that's machine-generated and off-limits.

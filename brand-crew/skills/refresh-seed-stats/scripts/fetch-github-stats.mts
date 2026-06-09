// fetch-github-stats.mts — prints fresh GitHub seed stats for data/profile.ts.
// No new deps (uses the public GitHub REST API via fetch). Reads the handle from
// data/profile.ts so it stays in sync. Set GITHUB_TOKEN to avoid rate limits.
//
//   pnpm tsx brand-crew/skills/refresh-seed-stats/scripts/fetch-github-stats.mts
//
// Output: { repos, stars, followers } JSON — the refresh-seed-stats skill copies
// these into profile.seedStats. Live runtime stats come from lib/github.ts; this
// only refreshes the build-time seed copy used as a fallback.

import { profile } from "../../../../data/profile"

const handle = profile.github.handle

const headers: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "User-Agent": "ai.thesatyajit.com stats-refresher",
}
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`)
  return res.json()
}

async function main() {
  const user = (await getJson(`https://api.github.com/users/${handle}`)) as {
    public_repos: number
    followers: number
  }

  // Sum stars across all public repos (paginated, 100/page).
  let stars = 0
  for (let page = 1; ; page++) {
    const repos = (await getJson(
      `https://api.github.com/users/${handle}/repos?per_page=100&page=${page}&type=owner`
    )) as Array<{ stargazers_count: number }>
    if (repos.length === 0) break
    stars += repos.reduce((acc, r) => acc + (r.stargazers_count ?? 0), 0)
    if (repos.length < 100) break
  }

  process.stdout.write(
    JSON.stringify(
      { repos: user.public_repos, stars, followers: user.followers },
      null,
      2
    ) + "\n"
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

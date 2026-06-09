// GitHub stats loader. Without GITHUB_TOKEN we return the deterministic dummy
// seed so the site builds and renders fully offline. With a token, a single
// GraphQL request fetches user info, top repos, language breakdown, and the
// contribution calendar — mapped into the same GitHubStats shape. Any failure
// (missing token, network, bad response) logs and falls back to the seed; this
// never throws.

import {
  dummyGitHubStats,
  type ContributionCalendar,
  type GitHubLanguage,
  type GitHubRepo,
  type GitHubStats,
} from "@/data/github-dummy"

const GITHUB_LOGIN = "satyajitghana"
const GRAPHQL_URL = "https://api.github.com/graphql"

export function isLiveGitHubData(): boolean {
  return Boolean(process.env.GITHUB_TOKEN)
}

const QUERY = `
query ($login: String!) {
  user(login: $login) {
    login
    name
    followers { totalCount }
    following { totalCount }
    repositories(
      first: 100
      ownerAffiliations: OWNER
      isFork: false
      orderBy: { field: STARGAZERS, direction: DESC }
    ) {
      totalCount
      nodes {
        name
        description
        stargazerCount
        url
        primaryLanguage { name color }
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays { date contributionCount }
        }
      }
    }
  }
}
`

type GqlRepo = {
  name: string
  description: string | null
  stargazerCount: number
  url: string
  primaryLanguage: { name: string; color: string | null } | null
  languages: {
    edges: { size: number; node: { name: string; color: string | null } }[]
  }
}

type GqlResponse = {
  data?: {
    user: {
      login: string
      name: string | null
      followers: { totalCount: number }
      following: { totalCount: number }
      repositories: { totalCount: number; nodes: GqlRepo[] }
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number
          weeks: {
            contributionDays: { date: string; contributionCount: number }[]
          }[]
        }
      }
    } | null
  }
  errors?: { message: string }[]
}

const FALLBACK_COLOR = "#8b8b8b"

function mapTopRepos(nodes: GqlRepo[]): GitHubRepo[] {
  return nodes.slice(0, 8).map((r) => ({
    name: r.name,
    description: r.description ?? "",
    language: r.primaryLanguage?.name ?? "Other",
    stars: r.stargazerCount,
    url: r.url,
  }))
}

function mapLanguages(nodes: GqlRepo[]): GitHubLanguage[] {
  const bytes = new Map<string, { size: number; color: string }>()
  for (const repo of nodes) {
    for (const edge of repo.languages.edges) {
      const prev = bytes.get(edge.node.name)
      bytes.set(edge.node.name, {
        size: (prev?.size ?? 0) + edge.size,
        color: edge.node.color ?? prev?.color ?? FALLBACK_COLOR,
      })
    }
  }

  const sorted = [...bytes.entries()].sort((a, b) => b[1].size - a[1].size)
  const total = sorted.reduce((sum, [, v]) => sum + v.size, 0)
  if (total === 0) return []

  const top = sorted.slice(0, 6)
  const langs: GitHubLanguage[] = top.map(([name, v]) => ({
    name,
    colorHex: v.color,
    pct: Math.round((v.size / total) * 100),
  }))

  const accounted = top.reduce((sum, [, v]) => sum + v.size, 0)
  const otherPct = Math.round(((total - accounted) / total) * 100)
  if (otherPct > 0) {
    langs.push({ name: "Other", colorHex: FALLBACK_COLOR, pct: otherPct })
  }
  return langs
}

function mapCalendar(cal: {
  totalContributions: number
  weeks: { contributionDays: { date: string; contributionCount: number }[] }[]
}): ContributionCalendar {
  return {
    totalContributions: cal.totalContributions,
    weeks: cal.weeks.map((w) => ({
      days: w.contributionDays.map((d) => ({
        date: d.date,
        count: d.contributionCount,
      })),
    })),
  }
}

export async function getGitHubStats(): Promise<GitHubStats> {
  const token = process.env.GITHUB_TOKEN
  if (!token) return dummyGitHubStats

  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: QUERY, variables: { login: GITHUB_LOGIN } }),
      next: { revalidate: 3600, tags: ["github"] },
    })

    if (!res.ok) {
      console.error(`[github] GraphQL request failed: ${res.status}`)
      return dummyGitHubStats
    }

    const json = (await res.json()) as GqlResponse
    if (json.errors?.length) {
      console.error(`[github] GraphQL errors: ${json.errors[0]?.message}`)
      return dummyGitHubStats
    }

    const user = json.data?.user
    if (!user) {
      console.error("[github] no user in GraphQL response")
      return dummyGitHubStats
    }

    const nodes = user.repositories.nodes
    const totalStars = nodes.reduce((sum, r) => sum + r.stargazerCount, 0)

    return {
      source: "live",
      user: {
        login: user.login,
        name: user.name ?? user.login,
        followers: user.followers.totalCount,
        following: user.following.totalCount,
        publicRepos: user.repositories.totalCount,
        totalStars,
        createdAt: dummyGitHubStats.user.createdAt,
      },
      topRepos: mapTopRepos(nodes),
      topLanguages: mapLanguages(nodes),
      contributions: mapCalendar(
        user.contributionsCollection.contributionCalendar
      ),
    }
  } catch (err) {
    console.error("[github] fetch failed, using seed data:", err)
    return dummyGitHubStats
  }
}

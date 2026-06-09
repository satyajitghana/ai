import { Heatmap } from "@/components/github/heatmap"
import { Languages } from "@/components/github/languages"
import { Repos } from "@/components/github/repos"
import { PageShell } from "@/components/site/page-shell"
import { getGitHubStats } from "@/lib/github"

export const metadata = {
  title: "GitHub",
  description: "GitHub activity, top repositories, and language breakdown.",
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="mt-16 mb-4 font-mono text-xs tracking-wide text-muted-foreground">
      ~/{label}
    </p>
  )
}

export default async function GitHubPage() {
  const stats = await getGitHubStats()
  const { user, contributions, topLanguages, topRepos } = stats

  return (
    <PageShell title="GitHub" agentPath={{ json: "/api/github" }}>
      {/* Stat strip */}
      <p className="font-mono text-xs text-muted-foreground">
        <span className="text-foreground">{user.publicRepos}</span> repos ·{" "}
        <span className="text-foreground">{user.totalStars}</span> stars ·{" "}
        <span className="text-foreground">{user.followers}</span> followers ·{" "}
        <span className="text-foreground">
          {contributions.totalContributions}
        </span>{" "}
        contributions
      </p>

      {/* Contribution calendar */}
      <SectionHeader label="contributions" />
      <Heatmap contributions={contributions} />

      {/* Languages */}
      <SectionHeader label="languages" />
      <Languages languages={topLanguages} />

      {/* Top repositories */}
      <SectionHeader label="repos" />
      <Repos repos={topRepos} />

      {stats.source === "seed" ? (
        <p className="mt-16 font-mono text-[10px] text-muted-foreground">
          seed data — set GITHUB_TOKEN for live stats
        </p>
      ) : null}
    </PageShell>
  )
}

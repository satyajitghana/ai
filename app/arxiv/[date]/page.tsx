import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PaperCard } from "@/components/papers/paper-card"
import { AgentChip } from "@/components/site/agent-chip"
import { PageShell } from "@/components/site/page-shell"
import { ShareButtons } from "@/components/site/share-buttons"
import { getArxivDigest, getArxivDigests } from "@/lib/content"

// Unknown slugs still 404 via notFound() below; `true` (a static literal, as
// Next requires) lets newly-added content resolve in dev without a restart.
export const dynamicParams = true

export function generateStaticParams() {
  return getArxivDigests().map((d) => ({ date: d.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>
}): Promise<Metadata> {
  const { date } = await params
  const digest = getArxivDigest(date)
  if (!digest) return {}
  return {
    title: `arXiv digest — ${digest.date}`,
    description: digest.papers.map((p) => p.title).join(" · "),
    alternates: { canonical: `/arxiv/${date}` },
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  const digest = getArxivDigest(date)
  if (!digest) notFound()

  const sorted = [...digest.papers].sort(
    (a, b) => Number(b.standout) - Number(a.standout)
  )

  return (
    <PageShell>
      <header className="mb-10">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            arXiv digest
          </h1>
          <AgentChip md={`/arxiv/${date}.md`} json="/api/arxiv" />
        </div>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {digest.date} · {digest.papers.length} papers · curated by
          paper-scout
        </p>
      </header>

      {digest.body.trim() ? (
        <p className="mb-8 max-w-prose leading-7 text-muted-foreground">
          {digest.body.trim()}
        </p>
      ) : null}

      <div className="space-y-6">
        {sorted.map((p) => (
          <PaperCard key={p.arxivId} paper={p} />
        ))}
      </div>
      <ShareButtons
        path={`/arxiv/${date}`}
        title={`arXiv digest — ${digest.date}`}
        className="mt-12 border-t pt-6"
      />
    </PageShell>
  )
}

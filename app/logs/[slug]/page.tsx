import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AgentChip } from "@/components/site/agent-chip"
import { PageShell } from "@/components/site/page-shell"
import { getLog, getLogs } from "@/lib/content"

// Unknown slugs still 404 via notFound() below; `true` (a static literal, as
// Next requires) lets newly-added content resolve in dev without a restart.
export const dynamicParams = true

export function generateStaticParams() {
  return getLogs().map((l) => ({ slug: l.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const log = getLog(slug)
  if (!log) return {}
  return {
    title: log.title ?? `Log — ${log.date}`,
    alternates: { canonical: `/logs/${slug}` },
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const log = getLog(slug)
  if (!log) notFound()

  const { default: Log } = await import(`@/content/logs/${slug}.mdx`)

  return (
    <PageShell>
      <article>
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-balance">
              {log.title ?? log.date}
            </h1>
            <AgentChip md={`/logs/${slug}.md`} json={`/api/posts/${slug}`} />
          </div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {log.date}
            {log.tags.length ? ` · ${log.tags.join(" · ")}` : ""}
          </p>
        </header>
        <Log />
      </article>
    </PageShell>
  )
}

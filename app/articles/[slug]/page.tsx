import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AgentChip } from "@/components/site/agent-chip"
import { PageShell } from "@/components/site/page-shell"
import { ShareButtons } from "@/components/site/share-buttons"
import { getArticle, getArticles } from "@/lib/content"
import { articleJsonLd, JsonLd } from "@/lib/jsonld"

// Unknown slugs still 404 via notFound() below; `true` (a static literal, as
// Next requires) lets newly-added content resolve in dev without a restart.
export const dynamicParams = true

export function generateStaticParams() {
  return getArticles({ includeDrafts: true }).map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) return {}
  return {
    title: article.title,
    description: article.description,
    alternates: {
      canonical: `/articles/${slug}`,
      types: { "text/markdown": `/articles/${slug}.md` },
    },
    openGraph: {
      type: "article",
      publishedTime: article.date,
      modifiedTime: article.updated ?? article.date,
      tags: article.tags,
    },
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) notFound()

  const { default: Article } = await import(`@/content/articles/${slug}.mdx`)

  return (
    <PageShell>
      <JsonLd data={articleJsonLd(article)} />
      <article>
        <header className="mb-10">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-balance">
              {article.title}
            </h1>
            <AgentChip md={`/articles/${slug}.md`} json="/api/articles" />
          </div>
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            {article.date} · {article.readingTimeMins} min
            {article.tags.length ? ` · ${article.tags.join(" · ")}` : ""}
          </p>
        </header>
        <Article />
      </article>
      <ShareButtons
        path={`/articles/${slug}`}
        title={article.title}
        className="mt-12 border-t pt-6"
      />
    </PageShell>
  )
}

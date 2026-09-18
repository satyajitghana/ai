import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AgentChip } from "@/components/site/agent-chip"
import { Citation } from "@/components/site/citation"
import { PageShell } from "@/components/site/page-shell"
import { ShareButtons } from "@/components/site/share-buttons"
import { getArticle, getArticles } from "@/lib/content"
import { articleJsonLd, breadcrumbJsonLd, JsonLd } from "@/lib/jsonld"

// MUST stay false. This route's body does a template-literal dynamic import
// (`@/content/articles/${slug}.mdx`), so the bundler cannot know which article
// is needed and pulls every one of them — plus everything they import — into
// this route's server bundle. With dynamicParams = true that whole bundle has
// to ship as a runtime function able to render an arbitrary slug, and at 238
// articles it reached 266 MB against Vercel's 250 MB function limit and failed
// the deploy. With it false, generateStaticParams below prerenders every slug
// at build time, unknown slugs get Next's static 404, and no function is
// emitted at all. Dev is unaffected: `next dev` compiles routes on demand and
// does not enforce dynamicParams.
export const dynamicParams = false

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
      modifiedTime: article.lastUpdated,
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
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Articles", path: "/articles" },
          { name: article.title, path: `/articles/${slug}` },
        ])}
      />
      <article>
        <header className="mb-10">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
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
      <Citation title={article.title} slug={slug} date={article.date} />
      <ShareButtons
        path={`/articles/${slug}`}
        title={article.title}
        className="mt-12 border-t pt-6"
      />
    </PageShell>
  )
}

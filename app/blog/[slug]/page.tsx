import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AgentChip } from "@/components/site/agent-chip"
import { PageShell } from "@/components/site/page-shell"
import { ShareButtons } from "@/components/site/share-buttons"
import { getBlogPost, getBlogPosts } from "@/lib/content"
import { blogPostingJsonLd, JsonLd } from "@/lib/jsonld"

// Unknown slugs still 404 via notFound() below; `true` (a static literal, as
// Next requires) lets newly-added content resolve in dev without a restart.
export const dynamicParams = true

export function generateStaticParams() {
  return getBlogPosts({ includeDrafts: true }).map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: `/blog/${slug}`,
      types: { "text/markdown": `/blog/${slug}.md` },
    },
    openGraph: {
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      tags: post.tags,
    },
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) notFound()

  const { default: Post } = await import(`@/content/blog/${slug}.mdx`)

  return (
    <PageShell>
      <JsonLd data={blogPostingJsonLd(post)} />
      <article>
        <header className="mb-10">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-balance">
              {post.title}
            </h1>
            <AgentChip md={`/blog/${slug}.md`} json={`/api/posts/${slug}`} />
          </div>
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            {post.date} · {post.readingTimeMins} min
            {post.tags.length ? ` · ${post.tags.join(" · ")}` : ""}
          </p>
        </header>
        <Post />
      </article>
      <ShareButtons
        path={`/blog/${slug}`}
        title={post.title}
        className="mt-12 border-t pt-6"
      />
    </PageShell>
  )
}

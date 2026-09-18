import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AgentChip } from "@/components/site/agent-chip"
import { PageShell } from "@/components/site/page-shell"
import { ShareButtons } from "@/components/site/share-buttons"
import { getBlogPost, getBlogPosts } from "@/lib/content"
import { blogPostingJsonLd, JsonLd } from "@/lib/jsonld"

// Paired with the template-literal `await import()` below, per the Next.js MDX
// guide, which documents that pattern with dynamicParams = false. With `true`
// the route must keep a runtime function able to render an arbitrary slug, and
// because the bundler cannot resolve a template-literal import it bundles every
// file in the directory into it. Unlisted slugs now get Next's static 404.
export const dynamicParams = false

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
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
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

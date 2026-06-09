import { getBlogPost, getBlogPosts } from "@/lib/content"
import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Blog post"
export const dynamicParams = false

export function generateStaticParams() {
  return getBlogPosts({ includeDrafts: true }).map((p) => ({ slug: p.slug }))
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getBlogPost(slug)
  return renderOgImage({
    kicker: "cat blog/" + slug + ".md",
    title: post?.title ?? "Blog",
    subtitle: post?.date,
  })
}

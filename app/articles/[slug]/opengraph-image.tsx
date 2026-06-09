import { getArticle, getArticles } from "@/lib/content"
import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Article"
export const dynamicParams = false

export function generateStaticParams() {
  return getArticles({ includeDrafts: true }).map((a) => ({ slug: a.slug }))
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = getArticle(slug)
  return renderOgImage({
    kicker: "cat articles/" + slug + ".md",
    title: article?.title ?? "Article",
    subtitle: article?.description,
  })
}

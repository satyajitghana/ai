import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { getArticle, getArticles } from "@/lib/content"
import { ogContentType, ogSize, renderOgImage } from "@/lib/og"
import { getThumb } from "@/lib/thumbs"

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
  // These images are prerendered at build (dynamicParams = false), so this read
  // happens there; *.jpg is excluded from every function's trace in
  // next.config.ts, and a missing file only means no picture.
  let picture: string | undefined
  const thumb = getThumb(slug)
  if (thumb) {
    try {
      const jpg = await readFile(join(process.cwd(), "public", "thumbs", `${slug}.jpg`))
      picture = `data:image/jpeg;base64,${jpg.toString("base64")}`
    } catch {}
  }
  return renderOgImage({
    kicker: "cat articles/" + slug + ".md",
    title: article?.title ?? "Article",
    subtitle: article?.description,
    picture,
  })
}

import { getLog, getLogs } from "@/lib/content"
import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Build log"
export const dynamicParams = false

export function generateStaticParams() {
  return getLogs().map((l) => ({ slug: l.slug }))
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const log = getLog(slug)
  return renderOgImage({
    kicker: "cat logs/" + slug + ".md",
    title: log?.title ?? log?.date ?? "Log",
    subtitle: log?.date,
  })
}

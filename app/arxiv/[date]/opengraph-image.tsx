import { getArxivDigest, getArxivDigests } from "@/lib/content"
import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "arXiv digest"
export const dynamicParams = false

export function generateStaticParams() {
  return getArxivDigests().map((d) => ({ date: d.slug }))
}

export default async function Image({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  const digest = getArxivDigest(date)
  const standout = digest?.papers.find((p) => p.standout)
  return renderOgImage({
    kicker: "arxiv digest " + date,
    title: standout ? standout.title : `arXiv digest — ${date}`,
    subtitle: `${digest?.papers.length ?? 0} papers · curated daily`,
  })
}

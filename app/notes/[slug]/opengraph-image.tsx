import { getNote, getNotes } from "@/lib/content"
import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Note"
export const dynamicParams = false

export function generateStaticParams() {
  return getNotes().map((n) => ({ slug: n.slug }))
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const note = getNote(slug)
  return renderOgImage({
    kicker: "cat notes/" + slug + ".md",
    title: note?.title ?? "Note",
    subtitle: note?.tags.join(" · "),
  })
}

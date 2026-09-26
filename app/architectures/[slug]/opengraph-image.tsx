import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { architectures } from "@/data/architectures"
import { getArchitectureDoc, getArchitectureDocs } from "@/lib/content"
import { archFilmKey } from "@/lib/films"
import { ogContentType, ogSize, renderOgImage } from "@/lib/og"
import { getThumb } from "@/lib/thumbs"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Architecture"
export const dynamicParams = false

export function generateStaticParams() {
  return getArchitectureDocs().map((d) => ({ slug: d.slug }))
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const doc = getArchitectureDoc(slug)
  // These images are prerendered at build (dynamicParams = false), so this read
  // happens there; *.jpg is excluded from every function's trace in
  // next.config.ts, and a missing file only means no picture.
  let picture: string | undefined
  if (getThumb(archFilmKey(slug))) {
    try {
      const jpg = await readFile(join(process.cwd(), "public", "thumbs", "architectures", `${slug}.jpg`))
      picture = `data:image/jpeg;base64,${jpg.toString("base64")}`
    } catch {}
  }
  return renderOgImage({
    kicker: "cat architectures/" + slug + ".md",
    title: doc?.title ?? architectures.find((a) => a.slug === slug)?.name ?? "Architecture",
    subtitle: doc?.description,
    picture,
  })
}

import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "How articles are scored — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "cat articles/scoring.md",
    title: "How articles are scored",
    subtitle: "Eight questions a reader would ask, each answered 0 to 3",
  })
}

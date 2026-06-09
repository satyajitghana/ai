import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Colophon — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "cat colophon",
    title: "Colophon",
    subtitle: "How this site works",
  })
}

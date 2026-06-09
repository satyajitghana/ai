import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Articles — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "ls articles",
    title: "Articles",
    subtitle: "Curated long-form writing on AI",
  })
}

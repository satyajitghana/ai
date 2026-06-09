import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Reading — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "cat reading.md",
    title: "Reading",
    subtitle: "Papers and books",
  })
}

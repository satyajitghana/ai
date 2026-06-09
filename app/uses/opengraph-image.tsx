import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Uses — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "cat uses.md",
    title: "Uses",
    subtitle: "Gear and tooling",
  })
}

import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Health — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "cat health.md",
    title: "Health",
    subtitle: "Quantified-self biomarker panel",
  })
}

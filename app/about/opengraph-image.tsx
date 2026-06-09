import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "About — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "cat about.md",
    title: "About",
    subtitle: "Head of Engineering · Inkers",
  })
}

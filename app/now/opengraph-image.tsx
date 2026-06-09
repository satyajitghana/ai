import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Now — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "cat now.md",
    title: "Now",
    subtitle: "What I'm focused on",
  })
}

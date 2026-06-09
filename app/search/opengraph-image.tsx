import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Search — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "/ search",
    title: "Search",
    subtitle: "Across everything",
  })
}

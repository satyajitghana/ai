import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "GitHub — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "open github",
    title: "GitHub",
    subtitle: "Repos, stars, contributions",
  })
}

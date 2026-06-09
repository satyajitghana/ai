import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "arXiv digest — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "ls arxiv",
    title: "arXiv digest",
    subtitle: "Personalized daily papers",
  })
}

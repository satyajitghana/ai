import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Snippets — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "ls snippets",
    title: "Snippets",
    subtitle: "Copy-paste code",
  })
}

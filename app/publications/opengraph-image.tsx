import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Publications — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "cat publications",
    title: "Publications",
    subtitle: "Peer-reviewed work",
  })
}

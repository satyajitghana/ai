import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Logs — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "ls logs",
    title: "Logs",
    subtitle: "Daily build logs",
  })
}

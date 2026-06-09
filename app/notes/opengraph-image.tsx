import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Notes — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "ls notes",
    title: "Notes",
    subtitle: "Digital garden",
  })
}

import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Patents — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "cat patents",
    title: "Patents",
    subtitle: "USPTO — patent pending",
  })
}

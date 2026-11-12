import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Architectures — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "ls architectures",
    title: "Architectures",
    subtitle: "The building blocks behind modern models, drawn and explained",
  })
}

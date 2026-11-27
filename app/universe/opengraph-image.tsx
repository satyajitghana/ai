import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "A history of everything — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "open /universe",
    title: "A history of everything",
    subtitle: "A talk in twenty-eight scenes, from the Big Bang to today",
  })
}

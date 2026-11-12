import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "AI breakthroughs in mathematics — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "ls math",
    title: "AI breakthroughs in mathematics",
    subtitle: "A short narrated video for each result family in openai/math",
  })
}

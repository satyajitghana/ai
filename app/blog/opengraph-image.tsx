import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Blog — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "ls blog",
    title: "Blog",
    subtitle: "Deep learning, 3D, CUDA, systems",
  })
}

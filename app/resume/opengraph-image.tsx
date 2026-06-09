import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Résumé — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "open resume",
    title: "Résumé",
    subtitle: "Deep learning · 3D perception · CUDA",
  })
}

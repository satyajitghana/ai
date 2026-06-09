import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Projects — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "ls projects",
    title: "Projects",
    subtitle: "3D perception · CUDA · DL tooling",
  })
}

import { profile } from "@/data/profile"
import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const alt = `${profile.name} — ${profile.title} @ ${profile.company.name}`
export const size = ogSize
export const contentType = ogContentType

export default function Image() {
  return renderOgImage({
    kicker: "whoami",
    title: profile.name,
    subtitle: `${profile.title} · ${profile.company.name}`,
    footerLeft: "deep learning · 3d perception · cuda",
  })
}

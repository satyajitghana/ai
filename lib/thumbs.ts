import manifest from "@/data/.generated/thumbs.json"
import { mediaUrl } from "@/lib/media"

// Every article's thumbnail: one still painted from its explainer-film
// storyboard (brand-crew/skills/explainer-films, `build.mjs --thumbs`) —
// the film's first mechanism scene, fully built, with its host. It is the
// cover of an article that has no film, and sits behind the title in its OG
// image.
//
// Read from the committed manifest, never by listing public/: an entry here
// means `pnpm validate:films` has checked the file exists and is current.
const thumbs = (manifest as { thumbs: Record<string, { style: string; mascot?: string }> }).thumbs

export function getThumb(slug: string): { src: string; style: string; width: number; height: number } | null {
  const t = thumbs[slug]
  return t ? { src: mediaUrl(`/thumbs/${slug}.jpg`), style: t.style, width: 1200, height: 630 } : null
}

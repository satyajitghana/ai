import manifest from "@/data/.generated/films.json"
import { mediaUrl } from "@/lib/media"

// Explainer films: a drawn, narrated explanation of how an article's subject
// works, rendered from a storyboard (data/films/<slug>.json) by
// brand-crew/skills/explainer-films.
//
// Keyed like the storyboards: an article by its bare slug, any other kind by
// `<kind>/<slug>` (data/films/architectures/<slug>.json →
// public/films/architectures/<slug>.mp4). The key is the path under /films/,
// so one lookup serves both; use archFilmKey() for an architecture doc.
//
// Read from the committed manifest, never from public/ — the page must not
// touch public/ with fs (it drags the whole directory into the function
// trace), and the manifest already carries everything the page needs.
// `pnpm validate:films` keeps the manifest, the storyboards and the files in
// step, so an entry here means the video exists and is current. Not every
// article has one: storyboards exist for all of them, films for a chosen set.

export type Film = {
  src: string
  poster: string
  captions: string
  duration: number
  width: number
  height: number
  rendered: string
  /** Every word the narrator says, in order. */
  transcript: string
  /** Painted at 640x360 and shipped at that size: scale it up with hard edges. */
  pixel: boolean
}

type Entry = { duration: number; rendered: string; transcript: string; style?: string }
const films = (manifest as { films: Record<string, Entry> }).films

/** The film and thumbnail key of an architecture doc (content/architectures/<slug>.mdx). */
export const archFilmKey = (slug: string) => `architectures/${slug}`

export function getFilm(slug: string): Film | null {
  const f = films[slug]
  if (!f) return null
  return {
    src: mediaUrl(`/films/${slug}.mp4`),
    poster: mediaUrl(`/films/${slug}-poster.webp`),
    captions: `/films/${slug}.vtt`,
    duration: f.duration,
    width: 960,
    height: 540,
    rendered: f.rendered,
    transcript: f.transcript,
    pixel: f.style === "pixel",
  }
}

/** ISO 8601 duration, as schema.org wants it: 32.75 → "PT33S". */
export const isoDuration = (s: number) => `PT${Math.round(s)}S`

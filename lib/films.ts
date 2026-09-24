import manifest from "@/data/.generated/films.json"

// Receipts films: a painted, narrated summary of an article, rendered from a
// storyboard (data/films/<slug>.json) by brand-crew/skills/receipt-films.
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
}

type Entry = { duration: number; rendered: string; transcript: string }
const films = (manifest as { films: Record<string, Entry> }).films

export function getFilm(slug: string): Film | null {
  const f = films[slug]
  if (!f) return null
  return {
    src: `/films/${slug}.mp4`,
    poster: `/films/${slug}-poster.webp`,
    captions: `/films/${slug}.vtt`,
    duration: f.duration,
    width: 960,
    height: 540,
    rendered: f.rendered,
    transcript: f.transcript,
  }
}

/** ISO 8601 duration, as schema.org wants it: 32.75 → "PT33S". */
export const isoDuration = (s: number) => `PT${Math.round(s)}S`

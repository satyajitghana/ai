// Where the heavy public assets are served from: films and their posters,
// thumbnails, and the images and clips articles embed with <Figure> and <Video>.
//
// Every file stays committed under public/, and that is what `pnpm validate`,
// `pnpm dev` and local builds use. On Vercel, NEXT_PUBLIC_MEDIA_BASE
// (https://media.thesatyajit.com/ai) points at Cloudflare R2, where
// .github/workflows/media-sync.yml mirrors them under ai/ and publishes
// ai/index.json: every uploaded path with the first 16 hex digits of its
// SHA-256. Before `next build`, scripts/media-map.mts fetches that index and
// keeps only the entries whose hash matches the file in this checkout, writing
// them to lib/media-map.json. So:
//
//   - a file R2 already holds, byte for byte, is served from R2 at
//     `${base}${path}?v=${hash}`. The URL changes when the content does, which
//     is what makes the bucket's year of immutable caching safe;
//   - anything else (a figure a pull request adds or changes, or everything if
//     the index cannot be fetched) stays same-origin, so a preview is never
//     broken by media that has not reached the bucket yet.
//
// The committed lib/media-map.json is empty: a local build is always
// same-origin. Captions stay same-origin too (a cross-origin <track> needs CORS),
// and so do the data files interactives fetch.
import map from "@/lib/media-map.json"

import { absoluteUrl } from "@/lib/site"

const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE ?? "").replace(/\/+$/, "")
const MAP = map as Record<string, string>

/** The URL a page should use for a file under public/ (path starts with "/"). */
export const mediaUrl = (path: string): string => {
  const v = MEDIA_BASE ? MAP[path] : undefined
  return v ? `${MEDIA_BASE}${path}?v=${v}` : path
}

/** mediaUrl as an absolute URL, for JSON-LD, feeds and the .md twins. */
export const absoluteMediaUrl = (path: string): string => {
  const u = mediaUrl(path)
  return isAbsolute(u) ? u : absoluteUrl(u)
}

export const isAbsolute = (url: string) => /^https?:\/\//.test(url)

// Where the heavy public assets are served from: films and their posters,
// thumbnails, and the images, clips and audio articles embed with <Figure>,
// <Video> and the sample players.
//
// Cloudflare R2 is the source of truth, not git. The bucket serves them at
// https://media.thesatyajit.com/ai (NEXT_PUBLIC_MEDIA_BASE overrides it), and
// lib/media-map.json, which is committed, lists every uploaded path with the
// first 16 hex digits of its SHA-256. `pnpm media:push` (scripts/media-push.mts)
// is the only writer of both: it uploads what is new or changed under public/
// and records it in the map, in the same commit as the content that uses it.
// The files themselves are gitignored (.gitignore lists which), so a clone has
// none of them and every build, local or Vercel, links them from R2.
// Thumbnails are the exception: they are pushed and also committed, because
// the OG routes read them at build.
//
//   - a mapped file is served at `${base}${path}?v=${hash}`. The URL changes
//     when the content does, which is what makes a year of immutable caching
//     at the edge safe;
//   - anything else is same-origin: captions (a cross-origin <track> needs
//     CORS), the JSON <Receipts> reads, and the data files interactives fetch.
//
// `pnpm validate:media` fails a checkout with media on disk that the map does
// not list, or lists with another hash: a file that was never pushed.
import map from "@/lib/media-map.json"

import { absoluteUrl } from "@/lib/site"

const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE || "https://media.thesatyajit.com/ai").replace(/\/+$/, "")
const MAP = map as Record<string, string>

/** The URL a page should use for a file under public/ (path starts with "/"). */
export const mediaUrl = (path: string): string => {
  const v = MAP[path]
  return v ? `${MEDIA_BASE}${path}?v=${v}` : path
}

/** mediaUrl as an absolute URL, for JSON-LD, feeds and the .md twins. */
export const absoluteMediaUrl = (path: string): string => {
  const u = mediaUrl(path)
  return isAbsolute(u) ? u : absoluteUrl(u)
}

export const isAbsolute = (url: string) => /^https?:\/\//.test(url)

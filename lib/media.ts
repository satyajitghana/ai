// Where the heavy public assets — film videos, posters and article thumbnails —
// are served from.
//
// Today they are committed to the repository and served by Vercel's CDN from
// public/, so the base is empty and every URL is same-origin. To move them to a
// dedicated media CDN (a bucket that mirrors public/films and public/thumbs
// behind a custom domain), set NEXT_PUBLIC_MEDIA_BASE to
// https://media.thesatyajit.com/ai — the bucket is shared by every
// thesatyajit.com site, and this one's files live under ai/ — and nothing
// else changes. Captions stay
// same-origin: a <track> from another origin needs CORS and crossorigin="".
//
// On the media CDN every file is cached for a year (.github/workflows/media-sync.yml
// uploads it with `Cache-Control: immutable`), but a re-rendered film keeps its
// filename, so its URL carries the render's hash from the manifest: a new render
// is a new URL, and nothing stale is ever served. Same-origin URLs stay bare —
// Vercel's CDN starts afresh on every deploy.
const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE ?? "").replace(/\/+$/, "")

export const mediaUrl = (path: string, version?: string) =>
  MEDIA_BASE && version ? `${MEDIA_BASE}${path}?v=${version}` : `${MEDIA_BASE}${path}`
export const isAbsolute = (url: string) => /^https?:\/\//.test(url)

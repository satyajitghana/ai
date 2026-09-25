// Where the heavy public assets — film videos, posters and article thumbnails —
// are served from.
//
// Today they are committed to the repository and served by Vercel's CDN from
// public/, so the base is empty and every URL is same-origin. To move them to a
// dedicated media CDN (a bucket that mirrors public/films and public/thumbs
// behind a custom domain), set NEXT_PUBLIC_MEDIA_BASE, e.g.
// https://media.thesatyajit.com — nothing else changes. Captions stay
// same-origin: a <track> from another origin needs CORS and crossorigin="".
const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE ?? "").replace(/\/+$/, "")

export const mediaUrl = (path: string) => `${MEDIA_BASE}${path}`
export const isAbsolute = (url: string) => /^https?:\/\//.test(url)

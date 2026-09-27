// Per-page search and share metadata: seo(path, title, description).
//
// Next.js merges metadata one key deep, so a page that sets no `alternates`,
// `openGraph` or `twitter` inherits the root layout's whole block. The layout
// once set canonical "/" and the homepage's og:title, og:url and twitter
// title: every page without its own (/now, /uses, /notes/*, /resume, …) told
// Google it was a duplicate of the homepage, and every shared article showed
// the site's blurb on X. The layout now sets none of those, and every route
// names its own canonical; content pages get all of it from here.
//
// Lengths: Google shows about 60 characters of a title and 155-160 of a
// description, and cuts the rest mid-word. Articles' descriptions are
// paragraphs (a median of about 580 characters) and most titles are
// "Subject: hook" at 60 or more before the layout's " · Satyajit Ghana". So the
// suffix is added only when the whole title still fits, and the description
// is its opening sentences up to 158 characters, or the first one cut at a
// word. The full text stays on the page and in the JSON-LD.
import type { Metadata } from "next"

import { SITE_NAME } from "@/lib/site"

const SUFFIX = ` · ${SITE_NAME}`
const TITLE_MAX = 60
const DESC_MAX = 158

export function snippet(text: string, max = DESC_MAX): string {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  // the last sentence end (".", "!" or "?" then a space, so "2.8T" is not one) that fits
  let end = 0
  for (const m of t.matchAll(/[.!?]["')\]]?(?=\s)/g)) {
    if (m.index + m[0].length > max) break
    end = m.index + m[0].length
  }
  if (end >= 80) return t.slice(0, end)
  const cut = t.slice(0, max - 1)
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:(—–-]+$/, "") + "…"
}

type OpenGraph = NonNullable<Metadata["openGraph"]>

export function seo(
  path: string,
  title: string,
  description?: string,
  opts: { markdown?: boolean; openGraph?: OpenGraph } = {},
): Metadata {
  const full = title.length + SUFFIX.length <= TITLE_MAX ? `${title}${SUFFIX}` : title
  const desc = description ? snippet(description) : undefined
  return {
    title: { absolute: full },
    description: desc,
    alternates: {
      canonical: path,
      types: {
        "application/rss+xml": "/feed.xml",
        ...(opts.markdown ? { "text/markdown": `${path}.md` } : {}),
      },
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      url: path,
      title,
      description: desc,
      ...opts.openGraph,
    } as OpenGraph,
    // images: none here, so Next fills twitter:image from the route's opengraph-image
    twitter: { card: "summary_large_image", creator: "@thesudoer_", title, description: desc },
  }
}

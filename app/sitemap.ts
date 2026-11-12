import type { MetadataRoute } from "next"

import {
  getArchitectureDocs,
  getArticles,
  getArxivDigests,
  getBlogPosts,
  getLogs,
  getNotes,
  getProjects,
} from "@/lib/content"
import { archFilmKey, getFilm } from "@/lib/films"
import { absoluteMediaUrl } from "@/lib/media"
import { snippet } from "@/lib/seo"
import { absoluteUrl } from "@/lib/site"
import { getThumb } from "@/lib/thumbs"

// Next writes sitemap fields into the XML as they are, unescaped (16.x,
// resolve-route-data.js), so any text that can hold `&` or `<` — a film's
// title and description — goes through this first.
const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")

// The newest date in a list of YYYY-MM-DD strings (they sort as text).
const newest = (dates: string[]) => dates.reduce<string | undefined>((a, d) => (!a || d > a ? d : a), undefined)

// An explainer's painted thumbnail (an image sitemap entry) and its film, when
// it has one (a video sitemap entry). Both live on media.thesatyajit.com, which
// Google allows for sitemap images and videos; the page itself carries the same
// film as a VideoObject. Key: a bare article slug or `architectures/<slug>`.
function media(key: string, title: string, description: string) {
  const thumb = getThumb(key)
  const film = getFilm(key)
  return {
    ...(thumb ? { images: [xml(absoluteMediaUrl(`/thumbs/${key}.jpg`))] } : {}),
    ...(film
      ? {
          videos: [
            {
              title: xml(title),
              thumbnail_loc: xml(absoluteMediaUrl(`/films/${key}-poster.webp`)),
              description: xml(snippet(description)),
              content_loc: xml(absoluteMediaUrl(`/films/${key}.mp4`)),
              duration: Math.round(film.duration),
              publication_date: film.rendered,
              family_friendly: "yes" as const,
            },
          ],
        }
      : {}),
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const articles = getArticles()
  const archDocs = getArchitectureDocs()
  const blog = getBlogPosts()
  const logs = getLogs()
  const projects = getProjects()
  const digests = getArxivDigests()
  const notes = getNotes()

  // An index page changes when its newest entry does; the rest carry no
  // lastmod rather than a made-up one.
  const indexLastMod: Record<string, string | undefined> = {
    "/": newest(articles.map((a) => a.lastUpdated)),
    "/articles": newest(articles.map((a) => a.lastUpdated)),
    "/architectures": newest(archDocs.map((d) => d.lastUpdated)),
    "/blog": newest(blog.map((p) => p.updated ?? p.date)),
    "/logs": newest(logs.map((l) => l.date)),
    "/projects": newest(projects.map((p) => p.date)),
    "/arxiv": newest(digests.map((d) => d.date)),
    "/notes": newest(notes.map((n) => n.updated ?? n.date)),
  }

  const staticPages: MetadataRoute.Sitemap = [
    "/",
    "/about",
    "/resume",
    "/projects",
    "/blog",
    "/articles",
    "/articles/scoring",
    "/models",
    "/architectures",
    "/math",
    "/logs",
    "/arxiv",
    "/publications",
    "/patents",
    "/github",
    "/health",
    "/now",
    "/uses",
    "/reading",
    "/snippets",
    "/notes",
    "/colophon",
    "/lab/neuron-lab",
    "/changelog",
    "/developers",
    "/developers/versioning",
    "/contact",
    "/privacy",
  ].map((p) => ({
    url: absoluteUrl(p),
    ...(indexLastMod[p] ? { lastModified: indexLastMod[p] } : {}),
    // The homepage and the index pages that grow most often rank as the
    // highest-priority, most-frequently-changing entries.
    changeFrequency:
      p === "/" || p === "/articles" || p === "/blog" || p === "/arxiv"
        ? ("daily" as const)
        : ("weekly" as const),
    priority: p === "/" ? 1 : p === "/articles" || p === "/blog" ? 0.8 : 0.6,
  }))

  return [
    ...staticPages,
    ...blog.map((p) => ({
      url: absoluteUrl(`/blog/${p.slug}`),
      lastModified: p.updated ?? p.date,
    })),
    ...articles.map((a) => ({
      url: absoluteUrl(`/articles/${a.slug}`),
      lastModified: a.lastUpdated,
      changeFrequency: "monthly" as const,
      priority: a.featured ? 0.8 : 0.7,
      ...media(a.slug, a.title, a.description),
    })),
    ...archDocs.map((d) => ({
      url: absoluteUrl(`/architectures/${d.slug}`),
      lastModified: d.lastUpdated,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      ...media(archFilmKey(d.slug), d.title, d.description),
    })),
    ...logs.map((l) => ({
      url: absoluteUrl(`/logs/${l.slug}`),
      lastModified: l.date,
    })),
    ...projects.map((p) => ({
      url: absoluteUrl(`/projects/${p.slug}`),
      lastModified: p.date,
    })),
    ...digests.map((d) => ({
      url: absoluteUrl(`/arxiv/${d.slug}`),
      lastModified: d.date,
    })),
    ...notes.map((n) => ({
      url: absoluteUrl(`/notes/${n.slug}`),
      lastModified: n.updated ?? n.date,
    })),
  ]
}

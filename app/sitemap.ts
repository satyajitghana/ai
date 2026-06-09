import type { MetadataRoute } from "next"

import {
  getArticles,
  getArxivDigests,
  getBlogPosts,
  getLogs,
  getNotes,
  getProjects,
} from "@/lib/content"
import { absoluteUrl } from "@/lib/site"

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    "/",
    "/about",
    "/resume",
    "/projects",
    "/blog",
    "/articles",
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
    "/changelog",
  ].map((p) => ({ url: absoluteUrl(p) }))

  return [
    ...staticPages,
    ...getBlogPosts().map((p) => ({
      url: absoluteUrl(`/blog/${p.slug}`),
      lastModified: p.updated ?? p.date,
    })),
    ...getArticles().map((a) => ({
      url: absoluteUrl(`/articles/${a.slug}`),
      lastModified: a.updated ?? a.date,
    })),
    ...getLogs().map((l) => ({
      url: absoluteUrl(`/logs/${l.slug}`),
      lastModified: l.date,
    })),
    ...getProjects().map((p) => ({
      url: absoluteUrl(`/projects/${p.slug}`),
      lastModified: p.date,
    })),
    ...getArxivDigests().map((d) => ({
      url: absoluteUrl(`/arxiv/${d.slug}`),
      lastModified: d.date,
    })),
    ...getNotes().map((n) => ({
      url: absoluteUrl(`/notes/${n.slug}`),
      lastModified: n.updated ?? n.date,
    })),
  ]
}

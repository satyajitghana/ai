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
  const staticPages: MetadataRoute.Sitemap = [
    "/",
    "/about",
    "/resume",
    "/projects",
    "/blog",
    "/articles",
    "/models",
    "/architectures",
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
  ].map((p) => ({
    url: absoluteUrl(p),
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
    ...getBlogPosts().map((p) => ({
      url: absoluteUrl(`/blog/${p.slug}`),
      lastModified: p.updated ?? p.date,
    })),
    ...getArticles().map((a) => ({
      url: absoluteUrl(`/articles/${a.slug}`),
      lastModified: a.updated ?? a.date,
      changeFrequency: "monthly" as const,
      priority: a.featured ? 0.8 : 0.7,
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

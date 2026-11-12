import { Feed } from "feed"

import { profile } from "@/data/profile"
import { getArticles, getBlogPosts, getLogs } from "@/lib/content"
import { absoluteUrl, siteUrl } from "@/lib/site"

// RSS feed of articles + blog + logs — subscribable by humans and agents alike.
//
// The newest FEED_ITEMS only. It once carried every item (707, ~800 KB), and a
// feed reader re-downloads the whole document on every poll to learn about one
// new entry. The archive is the sitemap, /llms.txt and /api/articles; a feed is
// for what is new.
export const dynamic = "force-static"
const FEED_ITEMS = 50

export function GET() {
  const feed = new Feed({
    title: `${profile.name} — articles, blog & logs`,
    description: profile.tagline,
    id: siteUrl,
    link: siteUrl,
    language: "en",
    copyright: `© ${new Date().getFullYear()} ${profile.name}`,
    author: { name: profile.name, link: siteUrl },
    // <atom:link rel="self">: the feed's own URL, which validators ask for
    feedLinks: { rss: absoluteUrl("/feed.xml") },
  })

  const items = [
    ...getArticles().map((a) => ({
      title: a.title,
      id: absoluteUrl(`/articles/${a.slug}`),
      link: absoluteUrl(`/articles/${a.slug}`),
      description: a.description,
      date: new Date(a.date),
    })),
    ...getBlogPosts().map((p) => ({
      title: p.title,
      id: absoluteUrl(`/blog/${p.slug}`),
      link: absoluteUrl(`/blog/${p.slug}`),
      description: p.description,
      date: new Date(p.date),
    })),
    ...getLogs().map((l) => ({
      title: l.title ?? `Log — ${l.date}`,
      id: absoluteUrl(`/logs/${l.slug}`),
      link: absoluteUrl(`/logs/${l.slug}`),
      description: l.body.slice(0, 280),
      date: new Date(l.date),
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, FEED_ITEMS)

  for (const item of items) feed.addItem(item)

  return new Response(feed.rss2(), {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  })
}

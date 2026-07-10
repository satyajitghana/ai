import type { Metadata } from "next"

import { PageShell } from "@/components/site/page-shell"
import { getArticles } from "@/lib/content"

import { ArticlesList } from "./articles-list"

export const metadata: Metadata = {
  title: "Articles",
  description:
    "Curated long-form writing on AI — explainers and essays.",
  alternates: { canonical: "/articles" },
}

export default function Page() {
  // Strictly newest-first by date (from the loader). A slim, serializable
  // projection is handed to the client list, which adds the Featured filter and
  // the ★ badge without changing order.
  const articles = getArticles().map((a) => ({
    slug: a.slug,
    title: a.title,
    date: a.date,
    description: a.description,
    readingTimeMins: a.readingTimeMins,
    tags: a.tags,
    featured: a.featured,
  }))

  return (
    <PageShell
      title="Articles"
      lede="Curated long-form writing on AI — explainers and essays."
      agentPath={{ json: "/api/articles" }}
    >
      <ArticlesList articles={articles} />
    </PageShell>
  )
}

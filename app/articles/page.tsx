import type { Metadata } from "next"

import Link from "next/link"

import { SCORING_PATH } from "@/components/site/article-rating"
import { PageShell } from "@/components/site/page-shell"
import { displayTags } from "@/data/taxonomy"
import { getArticles } from "@/lib/content"
import { highlights } from "@/lib/content/rating"
import { articleScores, compareByLens } from "@/lib/content/signals"
import { getThumb } from "@/lib/thumbs"

import { type ArticleCard, ArticlesList } from "./articles-list"

const LEDE =
  "Long-form explainers on AI, organised by what you want from them: the must-reads, what you can run yourself, ideas worth learning, and what's new."

export const metadata: Metadata = {
  title: "Articles",
  description: LEDE,
  alternates: { canonical: "/articles" },
}

export default function Page() {
  // The full corpus, server-rendered in the default lens (Must read) order so
  // the whole list is in the HTML for crawlers and no-JS readers. The client
  // list re-orders and filters a copy; it never fetches.
  const scores = articleScores()
  const articles: ArticleCard[] = getArticles()
    .sort(compareByLens("must-read", scores))
    .map((a) => {
      const s = scores.get(a.slug)!
      const thumb = getThumb(a.slug)
      return {
        slug: a.slug,
        title: a.title,
        description: a.description,
        why: a.rating?.why ?? null,
        date: a.date,
        updated: a.updated ?? null,
        lastUpdated: a.lastUpdated,
        tags: displayTags(a.tags),
        featured: a.featured,
        topic: a.topic ?? null,
        kind: a.articleKind ?? null,
        level: a.level ?? null,
        runsOn: a.runsOn ?? null,
        highlights: a.rating ? highlights(a.rating, a.runsOn, 2).map(({ key, text }) => ({ key, text })) : [],
        score: s.score,
        tier: s.tier,
        lenses: s.lenses,
        readingTimeMins: s.facts.readingTimeMins,
        thumb: thumb?.src ?? null,
      }
    })

  return (
    <PageShell
      title="Articles"
      lede={
        <>
          {LEDE}{" "}
          <Link
            href={SCORING_PATH}
            className="whitespace-nowrap text-foreground/80 underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground"
          >
            How articles are scored
          </Link>
        </>
      }
      agentPath={{ json: "/api/articles" }}
    >
      <ArticlesList articles={articles} />
    </PageShell>
  )
}

import type { Metadata } from "next"

import { PageShell } from "@/components/site/page-shell"
import { displayTags } from "@/data/taxonomy"
import { getArticles } from "@/lib/content"
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
        licence: a.licence ?? null,
        rating: a.rating
          ? {
              novelty: a.rating.novelty,
              verification: a.rating.verification,
              runnable: a.rating.runnable,
              explains: a.rating.explains,
              takeaway: a.rating.takeaway,
              durability: a.rating.durability,
              reach: a.rating.reach,
              unique: a.rating.unique,
            }
          : null,
        score: s.score,
        tier: s.tier,
        lenses: s.lenses,
        facts: {
          figures: s.facts.figures,
          interactives: s.facts.interactives,
          measured: s.facts.measured,
          film: s.facts.film,
          readingTimeMins: s.facts.readingTimeMins,
        },
        thumb: thumb?.src ?? null,
      }
    })

  return (
    <PageShell title="Articles" lede={LEDE} agentPath={{ json: "/api/articles" }}>
      <ArticlesList articles={articles} />
    </PageShell>
  )
}

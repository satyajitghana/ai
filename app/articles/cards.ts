import { displayTags } from "@/data/taxonomy"
import { getArticles } from "@/lib/content"
import { highlights } from "@/lib/content/rating"
import { articleScores, compareByLens } from "@/lib/content/signals"
import { snippet } from "@/lib/seo"
import { getThumb } from "@/lib/thumbs"

import type { ArticleCard } from "./articles-list"

// Every article as a list card, in the default lens (Newest) order. The page
// renders the first page of these and the client fetches the rest from
// /articles/cards.json (./cards.json/route.ts), which is built from this too.
export function articleCards(): ArticleCard[] {
  const scores = articleScores()
  return getArticles()
    .sort(compareByLens("newest", scores))
    .map((a) => {
      const s = scores.get(a.slug)!
      const thumb = getThumb(a.slug)
      return {
        slug: a.slug,
        title: a.title,
        // Only the search box reads it (every rated card shows `why`), and the
        // whole corpus of descriptions was a third of this payload. Its opening
        // sentences are what a search for the subject needs.
        description: snippet(a.description, 320),
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
}

import type { Metadata } from "next"

import Link from "next/link"

import { SCORING_PATH } from "@/components/site/article-rating"
import { PageShell } from "@/components/site/page-shell"
import type { TopicId } from "@/data/taxonomy"
import { collectionPageJsonLd, JsonLd } from "@/lib/jsonld"
import { seo } from "@/lib/seo"

import { ArticlesList } from "./articles-list"
import { articleCards } from "./cards"
import { PAGE } from "./page-size"

const LEDE =
  "Long-form explainers on AI, organised by what you want from them: the must-reads, what you can run yourself, ideas worth learning, and what's new."

export const metadata: Metadata = seo("/articles", "Articles", LEDE)

export default function Page() {
  // The first page of cards in the default lens (Newest), plus every other
  // article as a title link, so the whole corpus is still in the HTML for
  // crawlers and no-JS readers. Rendering every card in full made this page
  // 3.4 MB, and every crawl of it was read from Vercel's ISR store in 8 KB
  // units. The client fetches the full card data (/articles/cards.json) for
  // search, filters, lenses and "Show more".
  const cards = articleCards()
  const topicCounts: Partial<Record<TopicId, number>> = {}
  for (const a of cards) if (a.topic) topicCounts[a.topic] = (topicCounts[a.topic] ?? 0) + 1

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
      <JsonLd
        data={collectionPageJsonLd({
          path: "/articles",
          name: "Articles",
          description: LEDE,
          total: cards.length,
          items: cards.slice(0, PAGE).map((a) => ({ name: a.title, path: `/articles/${a.slug}` })),
        })}
      />
      <ArticlesList
        first={cards.slice(0, PAGE)}
        rest={cards.slice(PAGE).map(({ slug, title }) => ({ slug, title }))}
        topicCounts={topicCounts}
        rated={cards.filter((a) => a.tier).length}
      />
    </PageShell>
  )
}

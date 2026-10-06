import Link from "next/link"
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr"

import { FactChips, RubricBars, TierLabel } from "@/components/site/article-rating"
import { topicById } from "@/data/taxonomy"
import type { Article } from "@/lib/content"
import { getArticleScore } from "@/lib/content/signals"

// "What you get": the compact rating card under an article's title and cover.
// Server-rendered and JS-free, so it costs no layout shift. The rubric bars
// sit open from sm up and behind a <details> on a phone, where eight rows
// and the fact chips would push the first paragraph a screen down. Unrated articles show only
// their topic and facts, or nothing.
export function WhatYouGet({ article }: { article: Article }) {
  const s = getArticleScore(article.slug)
  const topic = article.topic ? topicById(article.topic) : undefined
  const rating = article.rating
  if (!rating && !topic) return null

  const meta = {
    kind: article.articleKind,
    level: article.level,
    runsOn: article.runsOn,
    licence: article.licence,
  }
  const topicLink = topic ? (
    <Link
      href={`/articles?topic=${topic.id}`}
      className="inline-flex min-h-11 items-center gap-1 font-mono text-xs text-muted-foreground underline decoration-foreground/20 underline-offset-4 hover:text-foreground hover:decoration-foreground sm:min-h-0"
    >
      {topic.label}
      <CaretRightIcon size={11} weight="bold" aria-hidden="true" />
    </Link>
  ) : null

  if (!rating || !s.tier || s.score === null) {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1">
        {topicLink}
        <FactChips facts={s.facts} meta={meta} />
      </div>
    )
  }

  return (
    <section aria-labelledby="what-you-get" className="mt-6 rounded-xl border bg-muted/20 px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <h2 id="what-you-get" className="flex items-center gap-3">
          <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">What you get</span>
          <TierLabel tier={s.tier} score={s.score} />
        </h2>
        {topicLink}
      </div>
      <p className="mt-1.5 text-[0.95rem] leading-6 text-foreground/85">{rating.why}</p>
      <RubricBars rating={rating} tier={s.tier} className="mt-3 hidden sm:grid" />
      <details className="group mt-1 sm:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-mono text-xs text-muted-foreground [&::-webkit-details-marker]:hidden">
          <CaretRightIcon size={11} weight="bold" aria-hidden="true" className="transition-transform group-open:rotate-90 motion-reduce:transition-none" />
          Scores and facts
        </summary>
        <RubricBars rating={rating} tier={s.tier} />
        <FactChips facts={s.facts} meta={meta} className="mt-3 pb-2" />
      </details>
      <FactChips facts={s.facts} meta={meta} className="mt-3 hidden sm:flex" />
    </section>
  )
}

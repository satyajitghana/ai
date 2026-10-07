import Link from "next/link"
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr"

import { DotLine, HighlightList, RubricDots, SCORING_PATH, TierMark } from "@/components/site/article-rating"
import { topicById } from "@/data/taxonomy"
import type { Article } from "@/lib/content"
import { highlights, practicalFacts, tierBand } from "@/lib/content/rating"
import { articleScores, getArticleScore } from "@/lib/content/signals"

// "Why read this": the short panel under an article's title and cover. It
// says what the page does for a reader — the editor's one-line why, up to
// three plain-language highlights and one line of practical facts — and keeps
// the eight-question breakdown behind a "How this was scored" disclosure, so
// above the fold it is four short lines on any screen. Server-rendered and
// JS-free (<details>), so it costs no layout shift. An unrated article gets
// just its topic and practical line.

const linkCls =
  "underline decoration-foreground/20 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"

export function WhyReadThis({ article }: { article: Article }) {
  const s = getArticleScore(article.slug)
  const topic = article.topic ? topicById(article.topic) : undefined
  const rating = article.rating
  const facts = practicalFacts({
    runsOn: article.runsOn,
    licence: article.licence,
    level: article.level,
    kind: article.articleKind,
  })
  if (!rating && !topic && !facts.length) return null

  const topicLink = topic ? (
    <Link href={`/articles?topic=${topic.id}`} className={linkCls}>
      {topic.label}
    </Link>
  ) : null
  // A highlight that already names the hardware ("Runs on a consumer GPU")
  // is not repeated in the fact line.
  const hs = rating ? highlights(rating, article.runsOn) : []
  const factLine = (
    <DotLine parts={[topicLink, ...facts.filter((f) => !hs.some((h) => h.text === f))]} className="font-mono text-xs leading-6 text-muted-foreground" />
  )

  if (!rating || !s.tier || s.score === null) return <div className="mt-6">{factLine}</div>

  const rated = [...articleScores().values()].filter((x) => x.rank !== null).length
  const band = tierBand(s.tier.id)

  return (
    <section aria-labelledby="why-read-this" className="mt-6 rounded-xl border bg-muted/20 px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="why-read-this" className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          Why read this
        </h2>
        <Link
          href={`${SCORING_PATH}#tiers`}
          aria-label={`${s.tier.label}: ${band.long}. How articles are scored`}
          title={`${s.tier.label}: ${band.long}`}
          className="-my-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <TierMark tier={s.tier} band />
        </Link>
      </div>
      <p className="mt-2 text-[0.95rem] leading-6 text-pretty text-foreground/90">{rating.why}</p>
      <HighlightList
        items={hs}
        className="mt-3 text-[13px] leading-5 text-foreground/80"
      />
      <div className="mt-3">{factLine}</div>

      <details className="group mt-3 border-t pt-1">
        <summary className="-mb-1 flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground sm:min-h-9 [&::-webkit-details-marker]:hidden">
          <CaretRightIcon
            size={11}
            weight="bold"
            aria-hidden="true"
            className="transition-transform group-open:rotate-90 motion-reduce:transition-none"
          />
          How this was scored
        </summary>
        <RubricDots rating={rating} className="mt-1" />
        <p className="mt-3 border-t pt-3 text-xs leading-5 text-muted-foreground">
          Score <span className="text-foreground tabular-nums">{Math.round(s.score)}</span> of 100, ranked{" "}
          <span className="text-foreground tabular-nums">{s.rank}</span> of {rated} rated articles. Each question is
          answered 0–3 by hand, and a 3 is rare.{" "}
          <Link href={SCORING_PATH} className={linkCls}>
            How articles are scored
          </Link>
        </p>
      </details>
    </section>
  )
}

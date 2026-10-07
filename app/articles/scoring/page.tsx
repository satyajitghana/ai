import type { Metadata } from "next"
import Link from "next/link"

import { TierMark } from "@/components/site/article-rating"
import { PageShell } from "@/components/site/page-shell"
import {
  ANALYSIS_BOTH,
  HIGHLIGHT_PHRASES,
  INFLATION_MEAN,
  INFLATION_MIN_RATED,
  LENSES,
  RUBRIC,
  TIERS,
  tierBand,
} from "@/lib/content/rating"
import { articleScores } from "@/lib/content/signals"
import { seo } from "@/lib/seo"

// The methodology behind the tier marks and "Why read this" panels: what each
// question means, the 0–3 anchors, how a score becomes a tier, and how the
// ratings are kept honest. Everything that can be read from code is (the
// questions, anchors, weights, shares, live tier ranges), so this page cannot
// drift from what the site actually does.

const TITLE = "How articles are scored"
const LEDE =
  "Every article here carries an editorial rating: eight questions a reader would ask, each answered 0 to 3 by hand. This is what each answer means, how answers become a tier, and how the ratings are kept honest."

export const metadata: Metadata = seo("/articles/scoring", TITLE, LEDE)

const h2 = "font-heading mt-14 mb-4 scroll-mt-24 text-xl font-semibold tracking-tight"
const prose = "max-w-prose space-y-4 leading-7"
const link = "underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"

function Dots({ v }: { v: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[1, 2, 3].map((s) => (
        <span
          key={s}
          className={
            s <= v
              ? "size-2 rounded-full border border-foreground/70 bg-foreground/70"
              : "size-2 rounded-full border border-foreground/25"
          }
        />
      ))}
    </span>
  )
}

const WEIGHT_WORD = (w: number) => (w > 1 ? "counts a little more" : w < 1 ? "counts a little less" : "counts once")

export default function ScoringPage() {
  const scores = [...articleScores().values()].filter((s) => s.tier && s.score !== null)
  const rated = scores.length
  const range = new Map<string, { n: number; lo: number; hi: number }>()
  for (const s of scores) {
    const r = range.get(s.tier!.id) ?? { n: 0, lo: Infinity, hi: -Infinity }
    r.n++
    r.lo = Math.min(r.lo, s.score!)
    r.hi = Math.max(r.hi, s.score!)
    range.set(s.tier!.id, r)
  }

  return (
    <PageShell title={TITLE} lede={LEDE}>
      <div className={prose}>
        <p>
          On the{" "}
          <Link href="/articles" className={link}>
            articles list
          </Link>{" "}
          each card shows a tier and a couple of highlights in plain words. On an article, the{" "}
          <span className="font-medium">Why read this</span> panel adds the one-line reason it is worth your time, and
          its <span className="font-medium">How this was scored</span> disclosure opens the eight answers behind it.
        </p>
        <p>
          A rating judges the subject <em>and</em> this page as you would read it. A landmark paper explained badly
          should not score well, and a modest tool taken apart carefully can.
        </p>
      </div>

      <h2 id="questions" className={h2}>
        The eight questions
      </h2>
      <p className={`${prose} mb-6 text-muted-foreground`}>
        Each is answered 0 to 3. The anchors are meant to be stingy: a 2 is a good page, and a 3 is rare.
      </p>
      <ol className="space-y-6">
        {RUBRIC.map((d, i) => (
          <li key={d.key} id={d.key} className="scroll-mt-24 rounded-xl border px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="font-medium">
                <span className="mr-2 font-mono text-xs text-muted-foreground">{i + 1}</span>
                {d.q}
              </h3>
              <span className="font-mono text-[11px] text-muted-foreground">
                {d.label.toLowerCase()} · {WEIGHT_WORD(d.weight)}
              </span>
            </div>
            <dl className="mt-3 grid gap-y-1.5 text-sm leading-6">
              {d.anchors.map((a, v) => (
                <div key={v} className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-baseline gap-x-3">
                  <dt className="flex items-center">
                    <Dots v={v} />
                    <span className="sr-only">{v} of 3</span>
                  </dt>
                  <dd className={v === 3 ? "text-foreground" : "text-foreground/80"}>
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Shown on a card as <span className="text-foreground">“{HIGHLIGHT_PHRASES[d.key][3]}”</span> at 3 and{" "}
              <span className="text-foreground">“{HIGHLIGHT_PHRASES[d.key][2]}”</span> at 2
              {d.key === "runnable" ? ", or by the hardware it runs on when that is a browser, phone, laptop or consumer GPU" : ""}
              {d.key === "verification" || d.key === "unique" ? (
                <>
                  . A 3 on both trust and “only here?” is said once, as{" "}
                  <span className="text-foreground">“{ANALYSIS_BOTH}”</span>
                </>
              ) : null}
              .
            </p>
          </li>
        ))}
      </ol>

      <h2 id="score" className={h2}>
        From answers to a score
      </h2>
      <div className={prose}>
        <p>
          The eight answers are combined into one number from 0 to 100. Trust counts a little more than the rest;
          runnability, durability and reach a little less. On top of that, a page earns up to 6 points for evidence it
          actually carries rather than claims: the paper&apos;s own figures, interactive explanations, numbers measured
          for the article, model and repository cards, and an explainer film. Those are counted from the page, never
          entered by hand, and each has diminishing returns, so padding a page does not pay.
        </p>
        <p>
          The number itself stays in the detail view and the{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- JSON endpoint, not a page */}
          <a href="/api/articles" className={link}>
            JSON
          </a>
          . What a card shows is the tier, because a rank among peers says more than a raw score.
        </p>
      </div>

      <h2 id="tiers" className={h2}>
        Tiers are percentiles
      </h2>
      <div className={prose}>
        <p>
          Every rated article is ranked by score, and the tiers take fixed shares of that ranking. However the scores
          drift, only a tenth of the articles can be Essential. Ties break on the most recently updated, then on the
          address, so the same commit always gives the same tiers.
        </p>
      </div>
      <div className="mt-6 overflow-hidden rounded-xl border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Tiers, the band of rated articles each covers, and the scores they currently span</caption>
          <thead className="bg-muted/40 font-mono text-[11px] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-normal">
                Tier
              </th>
              <th scope="col" className="px-4 py-2 font-normal">
                Band
              </th>
              <th scope="col" className="hidden px-4 py-2 font-normal sm:table-cell">
                Articles
              </th>
              <th scope="col" className="px-4 py-2 text-right font-normal">
                Scores now
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {TIERS.map((t) => {
              const r = range.get(t.id)
              return (
                <tr key={t.id}>
                  <th scope="row" className="px-4 py-2.5 font-normal">
                    <TierMark tier={t} />
                  </th>
                  <td className="px-4 py-2.5 text-muted-foreground">{tierBand(t.id).short}</td>
                  <td className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground tabular-nums sm:table-cell">
                    {r?.n ?? 0}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {r ? `${Math.round(r.lo)}–${Math.round(r.hi)}` : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 font-mono text-[11px] text-muted-foreground">
        {rated} rated articles. Drafts take no place in the ranking.
      </p>

      <h2 id="lenses" className={h2}>
        Ways to sort
      </h2>
      <p className={`${prose} mb-4`}>
        The list can be ordered for what you want from it. Each order reads only the answers that matter to it.
      </p>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        {LENSES.map((l) => (
          <div key={l.id} className="contents">
            <dt className="font-medium">
              <Link href={l.id === "newest" ? "/articles" : `/articles?lens=${l.id}`} className={link}>
                {l.label}
              </Link>
            </dt>
            <dd className="-mt-2 text-muted-foreground sm:mt-0">{l.blurb}</dd>
          </div>
        ))}
      </dl>

      <h2 id="honest" className={h2}>
        Keeping it honest
      </h2>
      <div className={prose}>
        <p>
          These are editorial judgements, not measurements, made by the same editor and agent crew that writes the
          pages. Four things keep them in check:
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-muted-foreground">
          <li>
            <span className="font-medium">Stingy anchors.</span> The expected average on every question is about 1.5.
            Once {INFLATION_MIN_RATED} articles are rated, the site&apos;s checks (<code>validate:ratings</code>) fail
            the build if any question&apos;s average across the corpus passes {INFLATION_MEAN}. An earlier, looser
            rating ended with most articles marked High; this one is built so that cannot happen quietly.
          </li>
          <li>
            <span className="font-medium">Tiers by rank.</span> Shares are fixed, so a generous week cannot promote
            everything.
          </li>
          <li>
            <span className="font-medium">Evidence is counted, not claimed.</span> The bonus comes from what the page
            carries, read off the page at build time.
          </li>
          <li>
            <span className="font-medium">Everything is public.</span> Every answer, score, rank and fact is in the{" "}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- JSON endpoint, not a page */}
            <a href="/api/articles" className={link}>
              articles JSON
            </a>{" "}
            and in{" "}
            <a href="/llms.txt" className={link}>
              llms.txt
            </a>
            , and every rating sits in its article&apos;s source next to the one-line reason for it.
          </li>
        </ul>
      </div>
    </PageShell>
  )
}

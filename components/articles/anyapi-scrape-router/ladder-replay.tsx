"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Replays AnyAPI's 100-page benchmark as if you had built the router yourself
// out of the four rival services it was compared against.
//
// Data: results.csv in the methodology gist
// (gist.github.com/kev1n/b02e7cb866b563b811c3870df81d1c3f, revision a99fa19,
// measured 2026-09-29 to 2026-10-01). Each page is encoded as
// tier letter + five ok/failed bits (AnyAPI, Firecrawl, Bright Data, Jina,
// Cloudflare) + ":" + site.
//
// Cost of one attempt. The gist publishes only a cost per 1,000 *real* pages
// for each service, so the per-attempt cost is back-derived as
// (cost per real page x successes / 100), an average over all 100 calls:
//   Cloudflare  $0.10 x 48/100 = $0.048 per 1k calls ($5/month plan excluded)
//   Jina        $0.73 x 55/100 = $0.4015 per 1k calls
//   Firecrawl   $3.97 x 90/100 = $3.573 per 1k calls at the Hobby rate the gist
//               used ($19 for 5,000 credits); scaled by 0.83/3.80 for the
//               Standard plan's annual rate ($83 for 100,000 credits)
//   Bright Data $1.50 per 1k successful requests, nothing on a failure
// The ladder stops at the first rung that returned the real page. Outcomes are
// the measured one-shot results, so this is a replay, not a simulation: it
// assumes a page that failed on one service would fail the same way again.
//
// Pure function of the controls: no randomness, no timers.

const PAGES =
  "e11111:wikipedia.org e11111:wikipedia.org e11111:wikipedia.org e11111:developer.mozilla.org e11111:developer.mozilla.org e11111:developer.mozilla.org e11111:docs.python.org e11111:docs.python.org e11111:docs.python.org e11111:doc.rust-lang.org e11111:doc.rust-lang.org e11111:doc.rust-lang.org e11111:arxiv.org e11111:arxiv.org e11111:arxiv.org e11111:gutenberg.org e11011:gutenberg.org e11011:gutenberg.org e11111:news.ycombinator.com e11111:news.ycombinator.com e11111:news.ycombinator.com e11111:theguardian.com e11111:theguardian.com e11111:theguardian.com e11111:bbc.com e11111:bbc.com e11111:bbc.com e11111:npr.org e11111:npr.org e11111:npr.org m11110:amazon.com m11110:amazon.com m11110:amazon.com m11110:walmart.com m11100:walmart.com m11100:walmart.com m11110:zillow.com m11110:zillow.com m11100:zillow.com m11111:target.com m11111:target.com m11111:target.com m11000:bestbuy.com m11000:bestbuy.com m11000:bestbuy.com m11100:imdb.com m11110:imdb.com m11100:imdb.com m11110:booking.com m11110:booking.com m11110:booking.com m11101:airbnb.com m11101:airbnb.com m11111:airbnb.com m11111:ebay.com m11111:ebay.com m11100:ebay.com m11111:costco.com m11111:costco.com m11111:costco.com h00000:shein.com h00000:shein.com h10100:shein.com h11100:g2.com h11100:g2.com h11100:g2.com h11100:hyatt.com h11100:hyatt.com h11100:hyatt.com h11000:lowes.com h11000:lowes.com h11000:lowes.com h11101:leboncoin.fr h11101:leboncoin.fr h11100:leboncoin.fr h11100:tripadvisor.com h11100:tripadvisor.com h11111:tripadvisor.com h11000:etsy.com h11000:etsy.com h11000:etsy.com h11100:idealista.com h11000:idealista.com h11100:idealista.com h11101:realtor.com h11100:realtor.com h11100:realtor.com h10000:yelp.com h10000:yelp.com h10000:yelp.com h11100:allegro.pl h11110:chatgpt.com m10100:google.com h10111:immobilienscout24.de h10100:instagram.com h10100:nordstrom.com m11011:youtube.com h11011:canadagoose.com h11110:indeed.com h11100:safeway.com"

type Svc = "firecrawl" | "bright" | "jina" | "cloudflare"
type Tier = "easy" | "medium" | "hard"
type Page = { tier: Tier; site: string; any: boolean; ok: Record<Svc, boolean> }

const TIER: Record<string, Tier> = { e: "easy", m: "medium", h: "hard" }

const DATA: Page[] = PAGES.split(" ").map((tok) => {
  const [code, site] = tok.split(":")
  const b = (i: number) => code[i] === "1"
  return {
    tier: TIER[code[0]],
    site,
    any: b(1),
    ok: { firecrawl: b(2), bright: b(3), jina: b(4), cloudflare: b(5) },
  }
})

const NAME: Record<Svc, string> = {
  cloudflare: "Cloudflare Browser Rendering",
  jina: "Jina Reader",
  bright: "Bright Data Web Unlocker",
  firecrawl: "Firecrawl (enhanced proxy)",
}

const COLOR: Record<Svc, string> = {
  cloudflare: "#f59e0b",
  jina: "#10b981",
  bright: "#3b82f6",
  firecrawl: "#ef4444",
}

// USD per 1,000 attempts; Bright Data is charged per success only.
function attemptCost(s: Svc, ok: boolean, fcStandard: boolean): number {
  if (s === "bright") return ok ? 1.5 : 0
  if (s === "cloudflare") return 0.048
  if (s === "jina") return 0.4015
  return fcStandard ? (3.573 * 0.83) / 3.8 : 3.573
}

export function LadderReplay() {
  const [order, setOrder] = useState<Svc[]>(["cloudflare", "jina", "bright", "firecrawl"])
  const [on, setOn] = useState<Record<Svc, boolean>>({
    cloudflare: true,
    jina: true,
    bright: true,
    firecrawl: true,
  })
  const [fcStandard, setFcStandard] = useState(false)

  const ladder = order.filter((s) => on[s])

  let spend = 0 // USD per 1,000 runs of the whole page list
  let wins = 0
  const servedBy: (Svc | null)[] = []
  const tally: Record<Svc, number> = { cloudflare: 0, jina: 0, bright: 0, firecrawl: 0 }
  for (const p of DATA) {
    let who: Svc | null = null
    for (const s of ladder) {
      const ok = p.ok[s]
      spend += attemptCost(s, ok, fcStandard)
      if (ok) {
        who = s
        break
      }
    }
    servedBy.push(who)
    if (who) {
      wins += 1
      tally[who] += 1
    }
  }
  const perReal = wins > 0 ? spend / wins : 0

  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= order.length) return
    const next = order.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
  }

  return (
    <figure className="not-prose my-8 rounded-lg border p-4">
      <div className="text-sm font-medium">Build the router out of the rivals</div>
      <p className="text-muted-foreground mt-1 text-xs">
        Order the rungs, switch them on or off. Each page goes down the ladder until a rung returned the real
        page in the benchmark.
      </p>

      <ol className="mt-3 space-y-1.5">
        {order.map((s, i) => (
          <li key={s} className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-4 font-mono">{i + 1}</span>
            <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: COLOR[s] }} />
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={on[s]}
                onChange={(e) => setOn({ ...on, [s]: e.target.checked })}
              />
              <span className={cn(!on[s] && "text-muted-foreground line-through")}>{NAME[s]}</span>
            </label>
            <span className="text-muted-foreground w-20 text-right font-mono">
              {on[s] ? `${tally[s]} served` : "off"}
            </span>
            <button
              type="button"
              className="rounded border px-1.5 font-mono disabled:opacity-30"
              disabled={i === 0}
              onClick={() => move(i, -1)}
              aria-label={`Move ${NAME[s]} up`}
            >
              ↑
            </button>
            <button
              type="button"
              className="rounded border px-1.5 font-mono disabled:opacity-30"
              disabled={i === order.length - 1}
              onClick={() => move(i, 1)}
              aria-label={`Move ${NAME[s]} down`}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>

      <label className="mt-3 flex items-center gap-2 text-xs">
        <input type="checkbox" checked={fcStandard} onChange={(e) => setFcStandard(e.target.checked)} />
        <span>
          Price Firecrawl at its Standard plan rate ($83 for 100,000 credits) instead of Hobby
        </span>
      </label>

      <div className="mt-4 grid grid-cols-10 gap-0.5 sm:grid-cols-20" role="img" aria-label="100 benchmark pages coloured by the rung that served each one">
        {DATA.map((p, i) => {
          const who = servedBy[i]
          return (
            <div
              key={i}
              title={`#${i + 1} ${p.site} (${p.tier}): ${who ? NAME[who] : "no rung got through"}${p.any ? "" : "; AnyAPI also failed"}`}
              className={cn("h-4 rounded-[2px]", !who && "border border-dashed")}
              style={who ? { background: COLOR[who] } : undefined}
            />
          )
        })}
      </div>
      <div className="text-muted-foreground mt-1 flex justify-between font-mono text-[10px]">
        <span>easy 1-30</span>
        <span>medium 31-60</span>
        <span>hard 61-100 (93, 97 medium)</span>
      </div>

      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <div className="rounded border p-3">
          <div className="text-muted-foreground">Your ladder</div>
          <div className="mt-1 font-mono text-lg">
            {wins}/100 <span className="text-sm">at ${perReal.toFixed(2)}</span>
          </div>
          <div className="text-muted-foreground">per 1,000 real pages</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-muted-foreground">AnyAPI, as published</div>
          <div className="mt-1 font-mono text-lg">
            98/100 <span className="text-sm">at $1.05</span>
          </div>
          <div className="text-muted-foreground">per 1,000 real pages</div>
        </div>
      </div>

      <figcaption className="text-muted-foreground mt-3 text-xs">
        Outcomes are the gist&apos;s own per-page results. Per-attempt costs are averages back-derived from each
        service&apos;s published cost per real page, so they ignore that a long page costs Jina more tokens and a
        slow one costs Cloudflare more browser time; Cloudflare&apos;s $5 monthly plan and every
        subscription commitment are left out. Dashed cells: no rung in your ladder got the page.
      </figcaption>
    </figure>
  )
}

export default LadderReplay

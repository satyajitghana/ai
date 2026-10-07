"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

// What a month of scraping costs on a prepaid wallet versus a plan, at the
// benchmark's own page mix.
//
// AnyAPI: $1.05 per 1,000 real pages, the gist's measured rate on its
// 100-page mix (gist kev1n/b02e7cb866b563b811c3870df81d1c3f). No plan.
// Bright Data Web Unlocker: $1.50 per 1,000 successful requests (gist).
// Firecrawl: credits per real page = 94/90. The gist reports 90 real pages at
// $3.97 per 1,000 on a $19-for-5,000-credit rate, which is $0.3573 for the run,
// or 94 credits. Plans are firecrawl.dev/pricing as read on 2026-10-06, monthly
// price when billed yearly: Free 1,000 credits $0; Hobby 5,000 credits $16;
// Standard 100,000 $83; Growth 500,000 $333; Scale 1,000,000 $599. Extra credits
// come in $5 packs of 1,000 / 2,000 / 2,500 / 5,000 on Hobby / Standard /
// Growth / Scale; the Free plan has no packs. The cheapest plan-plus-packs
// combination wins.
//
// Pure function of the slider.

type Plan = { name: string; usd: number; credits: number; pack: number | null }

const PLANS: Plan[] = [
  { name: "Free", usd: 0, credits: 1000, pack: null },
  { name: "Hobby", usd: 16, credits: 5000, pack: 1000 },
  { name: "Standard", usd: 83, credits: 100000, pack: 2000 },
  { name: "Growth", usd: 333, credits: 500000, pack: 2500 },
  { name: "Scale", usd: 599, credits: 1000000, pack: 5000 },
]

const CREDITS_PER_REAL_PAGE = 94 / 90

function firecrawl(pages: number): { usd: number; plan: string } {
  const credits = pages * CREDITS_PER_REAL_PAGE
  let best = { usd: Infinity, plan: "" }
  for (const p of PLANS) {
    let usd: number
    if (credits <= p.credits) usd = p.usd
    else if (p.pack === null) continue
    else usd = p.usd + Math.ceil((credits - p.credits) / p.pack) * 5
    if (usd < best.usd) best = { usd, plan: p.name }
  }
  return best
}

const fmtUsd = (x: number) =>
  x >= 100 ? `$${Math.round(x).toLocaleString("en-US")}` : `$${x.toFixed(2)}`

export function PlanVsWallet() {
  // slider 0..100 maps to 100..1,000,000 real pages a month on a log scale
  const [k, setK] = useState(50)
  const pages = Math.round(mpow(10, 2 + (k / 100) * 4) / 100) * 100

  const any = (pages * 1.05) / 1000
  const bright = (pages * 1.5) / 1000
  const fc = firecrawl(pages)
  const rows = [
    { name: "AnyAPI wallet", usd: any, note: "98/100 on the bench" },
    { name: `Firecrawl, ${fc.plan}`, usd: fc.usd, note: "90/100 on the bench" },
    { name: "Bright Data", usd: bright, note: "81/100 on the bench" },
  ]
  const max = Math.max(...rows.map((r) => r.usd), 1)
  const cheapest = rows.reduce((a, b) => (b.usd < a.usd ? b : a))

  return (
    <figure className="not-prose my-8 rounded-lg border p-4">
      <div className="text-sm font-medium">A month of scraping: wallet or plan?</div>
      <label className="mt-3 block text-xs">
        <span className="text-muted-foreground">Real pages you need a month: </span>
        <span className="font-mono">{pages.toLocaleString("en-US")}</span>
        <Range
          className="mt-1 w-full"
          min={0}
          max={100}
          step={1}
          value={k}
          onChange={(e) => setK(Number(e.target.value))}
          aria-label="Real pages per month"
        />
      </label>

      <div className="mt-4 space-y-2">
        {rows.map((r) => (
          <div key={r.name} className="text-xs">
            <div className="flex justify-between">
              <span>
                {r.name}
                <span className="text-muted-foreground">{" "}· {r.note}</span>
              </span>
              <span className="font-mono">{fmtUsd(r.usd)}/mo</span>
            </div>
            <div className="bg-muted mt-1 h-2 rounded">
              <div
                className="h-2 rounded"
                style={{
                  width: `${((r.usd / max) * 100).toFixed(2)}%`,
                  background: r === cheapest ? "var(--hg-accent, #2563eb)" : "#9ca3af",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <figcaption className="text-muted-foreground mt-3 text-xs">
        All three priced at the benchmark&apos;s page mix: AnyAPI at $1.05 and Bright Data at $1.50 per 1,000 real
        pages, Firecrawl at about 94 credits per 90 real pages on the cheapest plan plus $5 credit packs that covers
        the month (yearly-billed prices from firecrawl.dev/pricing, 2026-10-06). The success rates differ, so the
        services do not deliver the same pages; a page Firecrawl missed on the bench is not bought back by spending
        more.
      </figcaption>
    </figure>
  )
}

export default PlanVsWallet

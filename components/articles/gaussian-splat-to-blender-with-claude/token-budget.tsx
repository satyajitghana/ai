"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { TOKEN_SIZES } from "./data"
import { Frame, GREEN, Pill, STREAM } from "./viz"

// Image cost per loop, from the vision docs' formula (read 2026-10-31):
// ceil(w / 28) * ceil(h / 28) visual tokens, after scaling to fit the tier.
// Standard tier: 1,568 px long edge, 1,568 tokens. High-resolution tier
// (Claude 4.7 and later): 2,576 px, 4,784 tokens. This code is the same
// algorithm as code/tokens.py, which reproduces all six rows of the docs'
// own table (MEASURED against the docs). How many images a real loop sends is
// the reader's choice here, so the totals are REASONED.

const LIMITS = { standard: [1568, 1568], high: [2576, 4784] } as const
type Tier = keyof typeof LIMITS

const tokensOf = (w: number, h: number) => Math.ceil(w / 28) * Math.ceil(h / 28)

function fit(w: number, h: number, tier: Tier): [number, number] {
  const [edge, cap] = LIMITS[tier]
  if (Math.max(w, h) <= edge && tokensOf(w, h) <= cap) return [w, h]
  let lo = 0
  let hi = 1
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2
    const nw = Math.max(1, Math.floor(w * mid))
    const nh = Math.max(1, Math.floor(h * mid))
    if (Math.max(nw, nh) <= edge && tokensOf(nw, nh) <= cap) lo = mid
    else hi = mid
  }
  return [Math.max(1, Math.floor(w * lo)), Math.max(1, Math.floor(h * lo))]
}

const fmt = (n: number) => n.toLocaleString("en-US")

export function TokenBudget() {
  const [size, setSize] = useState(1)
  const [tier, setTier] = useState<Tier>("high")
  const [views, setViews] = useState(3)
  const [perView, setPerView] = useState(2)
  const [rounds, setRounds] = useState(8)
  const [windowK, setWindowK] = useState(1000)
  const s = TOKEN_SIZES[size]
  const [nw, nh] = fit(s.w, s.h, tier)
  const per = tokensOf(nw, nh)
  const perRound = per * views * perView
  const total = perRound * rounds
  const images = views * perView * rounds
  const win = windowK * 1000
  const pct = Math.min(100, (total / win) * 100)
  const fitRounds = Math.floor(win / Math.max(1, perRound))
  return (
    <Frame
      label="what the loop's pictures cost · formula from the vision docs · REASONED totals"
      right={
        <div className="flex gap-1.5">
          <Pill active={tier === "standard"} onClick={() => setTier("standard")}>
            standard tier
          </Pill>
          <Pill active={tier === "high"} onClick={() => setTier("high")}>
            high-res tier
          </Pill>
        </div>
      }
      note={
        <>
          Images stay in the conversation, so they add up round after round; clients that trim old images change this.
          The docs also say that when one request carries more than 20 images, a stricter per-image size limit applies to
          every image in it, counting images from earlier turns and those inside tool results: a long loop crosses that
          line quickly ({images} images here). Text tokens (code, tool output) are not counted.
        </>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {TOKEN_SIZES.map((t, k) => (
          <Pill key={`${t.w}x${t.h}`} active={k === size} onClick={() => setSize(k)}>
            {t.w}x{t.h}
          </Pill>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-muted-foreground">
          views per round: <b className="text-foreground">{views}</b>
          <Range min={1} max={8} step={1} value={views} onChange={(e) => setViews(Number(e.target.value))} accent={STREAM} />
        </label>
        <label className="block text-xs text-muted-foreground">
          images per view (splat, Blender, photo): <b className="text-foreground">{perView}</b>
          <Range min={1} max={3} step={1} value={perView} onChange={(e) => setPerView(Number(e.target.value))} accent={STREAM} />
        </label>
        <label className="block text-xs text-muted-foreground">
          rounds: <b className="text-foreground">{rounds}</b>
          <Range min={1} max={30} step={1} value={rounds} onChange={(e) => setRounds(Number(e.target.value))} accent={GREEN} />
        </label>
        <label className="block text-xs text-muted-foreground">
          your context window, thousand tokens: <b className="text-foreground">{fmt(windowK)}</b>
          <Range min={100} max={2000} step={100} value={windowK} onChange={(e) => setWindowK(Number(e.target.value))} accent={GREEN} />
        </label>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded border bg-muted/20 p-2">
          <dt className="text-muted-foreground">image after fitting</dt>
          <dd className="font-mono text-foreground">
            {nw} x {nh}
          </dd>
        </div>
        <div className="rounded border bg-muted/20 p-2">
          <dt className="text-muted-foreground">tokens per image</dt>
          <dd className="font-mono text-foreground">{fmt(per)}</dd>
        </div>
        <div className="rounded border bg-muted/20 p-2">
          <dt className="text-muted-foreground">per round</dt>
          <dd className="font-mono text-foreground">{fmt(perRound)}</dd>
        </div>
        <div className="rounded border bg-muted/20 p-2">
          <dt className="text-muted-foreground">after {rounds} rounds</dt>
          <dd className="font-mono text-foreground">{fmt(total)}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <div className="h-2.5 w-full rounded-full bg-muted/40" role="img" aria-label={`${pct.toFixed(0)} percent of the context window`}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 80 ? "oklch(0.62 0.16 35)" : STREAM }} />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {pct.toFixed(0)}% of a {fmt(win)}-token window; the window fills after about {fitRounds} rounds of this size.
        </p>
      </div>
    </Frame>
  )
}

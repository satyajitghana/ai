"use client"

// How Cycles draws a semi-transparent splat without sorting anything: the
// stochastic acceptance of Sun et al. (EGSR 2025), as implemented in
// intern/cycles/kernel/geom/gsplat_intersect.h. Every splat the ray meets is
// accepted as an opaque hit with probability alpha_i (its opacity times the
// Gaussian's peak response along the ray), whatever order the BVH visits them
// in; the closest accepted hit wins and is shaded. The chance that splat i
// wins is alpha_i times the product of (1 - alpha_j) over the splats in front
// of it, which is exactly the weight front-to-back alpha compositing gives it,
// so the average of many rays converges to the composited colour.
//
// The four alphas and colours below are made up for the demonstration
// (REASONED, not measured); the rule is the kernel's. The random numbers come
// from a seeded generator held in state, and nothing is sampled until a
// button is pressed, so the server render and the first client render match.

import { useState } from "react"

import { cn } from "@/lib/utils"

type Splat = { name: string; depth: number; alpha: number; rgb: [number, number, number] }

const SPLATS: Splat[] = [
  { name: "A", depth: 1, alpha: 0.35, rgb: [0.9, 0.45, 0.3] },
  { name: "B", depth: 2, alpha: 0.6, rgb: [0.35, 0.65, 0.4] },
  { name: "C", depth: 3, alpha: 0.25, rgb: [0.3, 0.45, 0.85] },
  { name: "D", depth: 4, alpha: 0.9, rgb: [0.85, 0.8, 0.35] },
]
const BG: [number, number, number] = [0.12, 0.12, 0.14]

// Expected share of each splat (and of the background): front-to-back compositing weights.
const WEIGHTS = (() => {
  let t = 1
  const w = SPLATS.map((s) => {
    const v = t * s.alpha
    t *= 1 - s.alpha
    return v
  })
  return { w, bg: t }
})()
const EXPECTED = [0, 1, 2].map(
  (ch) => SPLATS.reduce((acc, s, i) => acc + WEIGHTS.w[i] * s.rgb[ch], 0) + WEIGHTS.bg * BG[ch],
)

// mulberry32: a small seeded PRNG, so a sequence of clicks is reproducible.
function next(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, (seed + 0x6d2b79f5) | 0]
}

type State = { seed: number; counts: number[]; rays: number }
const INITIAL: State = { seed: 20261015, counts: [0, 0, 0, 0, 0], rays: 0 }

function trace(state: State, n: number, shuffled: boolean): State {
  let seed = state.seed
  const counts = state.counts.slice()
  for (let r = 0; r < n; r++) {
    // The BVH may visit the splats in any order; acceptance does not care.
    const order = [0, 1, 2, 3]
    if (shuffled) {
      for (let i = 3; i > 0; i--) {
        const [u, s] = next(seed)
        seed = s
        const j = Math.floor(u * (i + 1))
        ;[order[i], order[j]] = [order[j], order[i]]
      }
    }
    let best = -1
    for (const i of order) {
      const [u, s] = next(seed)
      seed = s
      if (u < SPLATS[i].alpha && (best < 0 || SPLATS[i].depth < SPLATS[best].depth)) best = i
    }
    counts[best < 0 ? 4 : best] += 1
  }
  return { seed, counts, rays: state.rays + n }
}

const css = (c: number[]) => `rgb(${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(",")})`
const pct = (v: number) => `${(v * 100).toFixed(1)}%`

const W = 640
const H = 150

export function StochasticRay() {
  const [st, setSt] = useState<State>(INITIAL)
  const [shuffled, setShuffled] = useState(true)

  const share = st.counts.map((c) => (st.rays ? c / st.rays : 0))
  const avg = [0, 1, 2].map((ch) =>
    st.rays ? SPLATS.reduce((acc, s, i) => acc + share[i] * s.rgb[ch], 0) + share[4] * BG[ch] : 0,
  )
  const err = st.rays ? Math.max(...[0, 1, 2].map((ch) => Math.abs(avg[ch] - EXPECTED[ch]))) : 0

  const x0 = 70
  const dx = 120
  const rows = [...SPLATS.map((s, i) => ({ label: `splat ${s.name}`, exp: WEIGHTS.w[i], got: share[i], rgb: s.rgb })), { label: "background", exp: WEIGHTS.bg, got: share[4], rgb: BG }]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>stochastic acceptance, one pixel</span>
        <span className="text-muted-foreground/60">the Cycles rule, illustrative alphas</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img">
            <title>
              A ray from a camera on the left passes four splats, A to D, with alphas 0.35, 0.6, 0.25 and 0.9.
              Each ray accepts each splat with probability alpha; the closest accepted one is shaded.
            </title>
            <line x1={20} y1={H / 2} x2={W - 20} y2={H / 2} className="stroke-muted-foreground" strokeDasharray="3 3" />
            <polygon points={`12,${H / 2 - 10} 30,${H / 2} 12,${H / 2 + 10}`} className="fill-foreground" />
            <text x={8} y={H / 2 + 26} fontSize={10} className="fill-muted-foreground font-mono">
              camera
            </text>
            {SPLATS.map((s, i) => (
              <g key={s.name}>
                <ellipse
                  cx={x0 + dx * (i + 0.5)}
                  cy={H / 2}
                  rx={22}
                  ry={46}
                  fill={css(s.rgb)}
                  fillOpacity={0.15 + s.alpha * 0.7}
                  stroke={css(s.rgb)}
                />
                <text x={x0 + dx * (i + 0.5)} y={16} fontSize={11} textAnchor="middle" className="fill-foreground font-mono">
                  {`${s.name}  α=${s.alpha}`}
                </text>
                <text x={x0 + dx * (i + 0.5)} y={H - 4} fontSize={10} textAnchor="middle" className="fill-muted-foreground font-mono">
                  {`wins ${pct(WEIGHTS.w[i])}`}
                </text>
              </g>
            ))}
            <rect x={W - 44} y={H / 2 - 18} width={30} height={36} rx={4} fill={css(BG)} className="stroke-border" />
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {[1, 16, 256, 4096].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSt((s) => trace(s, n, shuffled))}
              className="cursor-pointer rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {`+${n.toLocaleString("en-US")} ray${n > 1 ? "s" : ""}`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSt(INITIAL)}
            className="cursor-pointer rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            reset
          </button>
          <button
            type="button"
            aria-pressed={shuffled}
            onClick={() => setShuffled((v) => !v)}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              shuffled ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground",
            )}
          >
            visit splats in random order
          </button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1 font-mono text-[11px]">
            {rows.map((r) => (
              <div key={r.label} className="grid grid-cols-[84px_1fr_120px] items-center gap-2">
                <span className="text-muted-foreground">{r.label}</span>
                <div className="relative h-3 rounded bg-muted/40">
                  <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${r.got * 100}%`, background: css(r.rgb), opacity: 0.85 }} />
                  <div className="absolute inset-y-[-2px] w-[2px] bg-foreground" style={{ left: `${r.exp * 100}%` }} />
                </div>
                <span className="text-foreground">{`${pct(r.got)} / ${pct(r.exp)}`}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
            <div className="text-center">
              <div className="h-12 w-12 rounded border" style={{ background: st.rays ? css(avg) : "transparent" }} />
              <div className="mt-1">average</div>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 rounded border" style={{ background: css(EXPECTED) }} />
              <div className="mt-1">composited</div>
            </div>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {st.rays
            ? `${st.rays.toLocaleString("en-US")} rays traced; largest channel error ${err.toFixed(3)}. Bars are observed shares, ticks the compositing weights.`
            : "No rays yet. Each ray keeps the closest splat it accepted; bars will show how often each one won, ticks the alpha-compositing weight it should win with."}
        </p>
      </div>
    </figure>
  )
}

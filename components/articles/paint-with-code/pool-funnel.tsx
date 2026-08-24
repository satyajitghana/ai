"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Where the reference pool came from, and why it is not just the 117 good ones.
//
// The published counts: 1,664 generations hand-rated one at a time into love,
// okay and nope; 117 landed in love-tier and seeded the comparison pool; 266
// okay-tier and 198 supplements from a separate generation run — added "to widen
// the comparison set in colours where hand-rated examples were thin" — bring the
// pool to 581. 117 + 266 + 198 = 581, and 1,664 - 383 = 1,281 rejected, so
// roughly 77% of everything generated was thrown away.
//
// The curve below is the part the post leaves implicit. A comparison reward is
// only informative where the opponents are near the policy's own level: beat
// everything and the reward pins at 1, lose to everything and it pins at 0, and
// either way the gradient goes flat. That is the same compression failure the
// switch away from absolute scoring was meant to fix — so a pool made only of
// the 117 best paintings would have reintroduced it. The tier quality values are
// illustrative; the counts and the shape of the argument are not.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

const LOVE = 117
const OKAY = 266
const SUPP = 198
const POOL = LOVE + OKAY + SUPP // 581
const RATED = 1664
const KEPT = LOVE + OKAY // 383
const NOPE = RATED - KEPT // 1281

// illustrative quality of a reference drawn from each tier
const T = { love: 0.82, okay: 0.55, supp: 0.62 }

type PoolKey = "love" | "rated" | "full"

const POOLS: Record<PoolKey, { l: string; n: number; w: [number, number, number]; note: string }> = {
  love: { l: "love-tier only", n: LOVE, w: [1, 0, 0], note: "the pool as first seeded — 117 paintings" },
  rated: { l: "everything hand-rated", n: KEPT, w: [LOVE / KEPT, OKAY / KEPT, 0], note: "love + okay, 383 paintings" },
  full: {
    l: "the shipped pool",
    n: POOL,
    w: [LOVE / POOL, OKAY / POOL, SUPP / POOL],
    note: "love + okay + supplements, 581 paintings",
  },
}

// P(judge prefers a rollout of quality q over a reference of quality t).
// Rational sigmoid: only + - * / and abs, so it is bit-identical in Node and the
// browser and nothing hydrates differently.
const win = (q: number, t: number) => {
  const d = q - t
  return 0.5 + (0.5 * d) / (0.35 + (d < 0 ? -d : d))
}

const expected = (q: number, w: [number, number, number]) =>
  w[0] * win(q, T.love) + w[1] * win(q, T.okay) + w[2] * win(q, T.supp)

export function PoolFunnel() {
  const [q, setQ] = useState(58)
  const [pool, setPool] = useState<PoolKey>("full")

  const qq = q / 100

  const rows = useMemo(
    () =>
      (Object.keys(POOLS) as PoolKey[]).map((k) => {
        const w = POOLS[k].w
        const e = expected(qq, w)
        const slope = (expected(qq + 0.02, w) - expected(qq - 0.02, w)) / 0.04
        return { k, e, slope }
      }),
    [qq],
  )

  const cur = rows.find((r) => r.k === pool)!
  const best = rows.reduce((a, b) => (b.slope > a.slope ? b : a))

  const W = 720
  const CH = 158
  const X0 = 54
  const X1 = 596
  const Y0 = 26
  const Y1 = 126
  const QX = (v: number) => X0 + ((v - 0.2) / 0.8) * (X1 - X0)
  const RY = (v: number) => Y1 - v * (Y1 - Y0)

  const curve = (w: [number, number, number]) => {
    let d = ""
    for (let i = 0; i <= 64; i++) {
      const v = 0.2 + (i / 64) * 0.8
      d += `${i === 0 ? "M" : "L"} ${QX(v).toFixed(2)} ${RY(expected(v, w)).toFixed(2)} `
    }
    return d
  }

  const COLORS: Record<PoolKey, string> = { love: WARM, rated: MUTED, full: GOOD }

  const FUNNEL = [
    { l: "nope", n: NOPE, c: MUTED, o: 0.25 },
    { l: "okay", n: OKAY, c: ACCENT, o: 0.6 },
    { l: "love", n: LOVE, c: GOOD, o: 0.95 },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {LOVE} + {OKAY} + {SUPP} = {POOL} reference paintings, from {RATED.toLocaleString()} rated one at a time
        </span>
        <span className="font-mono text-[10px]" style={{ color: WARM }}>
          {((NOPE / RATED) * 100).toFixed(0)}% rated nope
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            the rating pass — {RATED.toLocaleString()} generations, one at a time
          </div>
          <div className="mt-2 flex h-6 w-full overflow-hidden rounded-sm bg-muted/40">
            {FUNNEL.map((f) => (
              <div
                key={f.l}
                className="flex items-center justify-center"
                style={{ width: `${(f.n / RATED) * 100}%`, background: f.c, opacity: f.o }}
                title={`${f.l}: ${f.n}`}
              />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {FUNNEL.map((f) => (
              <span key={f.l} className="flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground">
                <span className="inline-block h-2 w-3 rounded-sm" style={{ background: f.c, opacity: f.o }} />
                {f.l} · <span className="tabular-nums text-foreground">{f.n.toLocaleString()}</span> ·{" "}
                {((f.n / RATED) * 100).toFixed(1)}%
              </span>
            ))}
          </div>
          <div className="mt-2 font-mono text-[9px] text-muted-foreground">
            the {LOVE} love-tier seeded the comparison pool · {OKAY} okay-tier and {SUPP} supplements from a separate
            generation run widened it to {POOL}, in the colours where hand-rated examples were thin
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Object.keys(POOLS) as PoolKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPool(k)}
              aria-pressed={pool === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                pool === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {POOLS[k].l} · {POOLS[k].n}
            </button>
          ))}
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${CH}`} width={W} height={CH} role="img" className="min-w-[660px] max-w-full">
            <title>
              Expected pairwise reward plotted against rollout quality for three candidate reference pools. The
              love-tier-only curve stays low and flat across the mid-quality range; the shipped 581-painting pool
              rises through the middle of that range with a much steeper slope.
            </title>

            <line x1={X0} y1={Y1} x2={X1} y2={Y1} stroke="currentColor" strokeOpacity={0.25} />
            <line x1={X0} y1={Y0} x2={X0} y2={Y1} stroke="currentColor" strokeOpacity={0.25} />
            {[0, 0.5, 1].map((v) => (
              <g key={v}>
                <line x1={X0 - 4} y1={RY(v)} x2={X1} y2={RY(v)} stroke="currentColor" strokeOpacity={0.1} />
                <text
                  x={X0 - 7}
                  y={RY(v) + 3}
                  fontSize={8}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity={0.45}
                  fontFamily="ui-monospace, monospace"
                >
                  {v.toFixed(1)}
                </text>
              </g>
            ))}
            <text x={X0 - 46} y={14} fontSize={8.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              expected reward
            </text>
            <text x={X1} y={Y1 + 14} fontSize={8.5} textAnchor="end" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              rollout quality →
            </text>

            {/* the selected curve last, so it is never hidden under a coincident one */}
            {(Object.keys(POOLS) as PoolKey[])
              .sort((a, b) => (a === pool ? 1 : 0) - (b === pool ? 1 : 0))
              .map((k) => (
                <path
                  key={k}
                  d={curve(POOLS[k].w)}
                  fill="none"
                  stroke={COLORS[k]}
                  strokeWidth={k === pool ? 2.2 : 1.2}
                  strokeOpacity={k === pool ? 0.95 : 0.45}
                />
              ))}

            <line x1={QX(qq)} y1={Y0} x2={QX(qq)} y2={Y1} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 3" />
            <circle cx={QX(qq)} cy={RY(cur.e)} r={4.5} fill={COLORS[pool]} />
            <text
              x={QX(qq) + 8}
              y={RY(cur.e) - 6}
              fontSize={9}
              fill={COLORS[pool]}
              fontFamily="ui-monospace, monospace"
            >
              {cur.e.toFixed(2)}
            </text>

            {/* where the reference tiers sit */}
            {(
              [
                ["love", T.love, GOOD],
                ["supp", T.supp, ACCENT],
                ["okay", T.okay, ACCENT],
              ] as const
            ).map(([l, t, c]) => (
              <g key={l}>
                <line x1={QX(t)} y1={Y1} x2={QX(t)} y2={Y1 + 5} stroke={c} strokeOpacity={0.6} />
                <text
                  x={QX(t)}
                  y={Y1 + 14}
                  fontSize={8}
                  textAnchor="middle"
                  fill={c}
                  fillOpacity={0.8}
                  fontFamily="ui-monospace, monospace"
                >
                  {l}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-32 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            rollout quality
          </span>
          <Range
            min={20}
            max={100}
            step={1}
            value={q}
            onChange={(e) => setQ(Number(e.target.value))}
            className="flex-1"
            aria-label="how good the current policy's paintings are"
            accent={COLORS[pool]}
          />
          <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            {qq.toFixed(2)}
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {rows.map((r) => (
            <div
              key={r.k}
              className={cn("rounded-lg border px-3 py-2", r.k === pool ? "bg-muted/40" : "bg-muted/20")}
              style={{ borderColor: r.k === pool ? `${COLORS[r.k]}66` : undefined }}
            >
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{POOLS[r.k].l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: COLORS[r.k] }}>
                {r.slope.toFixed(2)}
              </div>
              <div className="font-mono text-[9px] text-muted-foreground">
                reward per unit of quality · E[r] = {r.e.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1.5 font-mono text-[9px] text-muted-foreground">
          steepest here: <span style={{ color: COLORS[best.k] }}>{POOLS[best.k].l}</span> · the hand-rated and
          shipped curves almost coincide — the 198 supplements widen colour coverage, the 266 okay-tier do the work
          on the gradient · tier quality values are illustrative; the counts are the published ones
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Rating 1,664 images one at a time to keep {LOVE} is the least glamorous part of this project and probably
          the most important. But the pool that shipped is not the {LOVE}. It is {POOL}, and the {OKAY + SUPP}{" "}
          additions are the ones doing work the love-tier cannot.
          <br />
          <br />
          A comparison reward only carries information where the opponents are near the policy&rsquo;s own level.
          Judge a mid-training rollout against nothing but the best paintings in the collection and it loses almost
          every comparison, the reward pins near zero, and{" "}
          <span className="text-foreground">the gradient flattens for exactly the reason the 0–10 scale flattened</span>.
          Drag the quality slider through the middle of the range and watch the love-only curve stay low while the
          shipped pool climbs through its steepest section. Widening the pool with merely-okay paintings looks like
          lowering the bar; it is really moving the opponents to where the policy can learn from losing.
        </p>
      </div>
    </figure>
  )
}

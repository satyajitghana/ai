"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Why swapping "score this from 0 to 10" for "which of these is better" opened
// the dynamic range, when the pairwise reward has *fewer* nominal levels.
//
// Two references per rollout means the pairwise reward can only be 0, 0.5 or 1.
// Three levels, against eleven. On paper that is a downgrade. In practice the
// post reports the absolute scores "came back compressed near zero", which means
// the eleven levels were spent on two or three adjacent ones — and GRPO
// normalizes within a group, so what actually matters is not how many levels the
// scale has but how many pairs of rollouts in the group the reward can tell
// apart. A tie carries no direction.
//
// The simulation below is illustrative, not measured. Eight rollouts on one
// prompt are given latent qualities; the absolute judge maps quality through a
// compressive scale and rounds to an integer; the pairwise judge samples two
// references and reports wins. The parameters are sliders precisely because none
// of them is published — the shape is the point, not the numbers.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

const G = 8 // rollouts per GRPO group

// Lehmer LCG. 16807 * (2^31 - 2) stays well under 2^53, so every step is exact
// on every engine — no transcendentals, nothing to disagree about at hydration.
function lcg(seed: number) {
  let s = ((seed * 7919) % 2147483646) + 1
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

export function PairwiseVsAbsolute() {
  const [comp, setComp] = useState(20)
  const [spread, setSpread] = useState(8)
  const [seed, setSeed] = useState(4)

  const sim = useMemo(() => {
    const hr = spread / 100
    const q = Array.from({ length: G }, (_, i) => 0.48 + ((i - 3.5) / 3.5) * hr)

    // absolute: a 0-10 scale the judge only ever spends the bottom of
    const c = comp / 100
    const abs = q.map((v) => Math.max(0, Math.min(10, Math.round(10 * c * v))))

    // pairwise: two references sampled per rollout, reward = fraction won
    const rand = lcg(seed)
    const pair = q.map((v) => {
      let wins = 0
      for (let k = 0; k < 2; k++) {
        const t = 0.30 + rand() * 0.55 // a reference drawn from the pool
        const d = v - t
        const p = 0.5 + (0.5 * d) / (0.35 + (d < 0 ? -d : d))
        if (rand() < p) wins++
      }
      return wins / 2
    })

    const score = (r: number[]) => {
      let tied = 0
      let right = 0
      let total = 0
      for (let i = 0; i < G; i++) {
        for (let j = i + 1; j < G; j++) {
          total++
          if (r[i] === r[j]) tied++
          else if (r[i] > r[j] === q[i] > q[j]) right++
        }
      }
      const untied = total - tied
      return {
        levels: new Set(r).size,
        tiedPct: (tied / total) * 100,
        rightPct: untied === 0 ? 0 : (right / untied) * 100,
        untied,
        total,
      }
    }

    return { q, abs, pair, a: score(abs), p: score(pair) }
  }, [comp, spread, seed])

  const W = 720
  const H = 176
  const AX0 = 40
  const AX1 = 664

  // A stack of eight dots runs off the top of the canvas the moment the judge
  // puts them all on one integer -- which is exactly the case worth drawing. So
  // each used level gets a bar whose height is the count instead.
  const bars = (vals: number[], lo: number, hi: number) => {
    const counts = new Map<number, number>()
    for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1)
    return [...counts.entries()].map(([v, n]) => ({
      v,
      n,
      x: AX0 + ((v - lo) / (hi - lo)) * (AX1 - AX0),
      h: (n / G) * 34,
    }))
  }

  const A_AXIS = 64
  const P_AXIS = 152
  const absBars = bars(sim.abs, 0, 10)
  const pairBars = bars(sim.pair, 0, 1)

  const pct = (m: { untied: number; rightPct: number }) => (m.untied === 0 ? "\u2014" : `${m.rightPct.toFixed(0)}%`)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          eight rollouts on one prompt — how many of the {sim.a.total} pairs can each reward tell apart?
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          pairwise orders {sim.p.untied} pairs · absolute orders {sim.a.untied}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              Two number lines with a bar at each reward value showing how many of the eight rollouts landed there.
              On the upper zero-to-ten absolute scale the rollouts pile onto one or two adjacent integers near the
              left end. On the lower pairwise scale, which has only three positions, they spread across all of them.
            </title>

            {(
              [
                ["absolute 0–10 — eleven levels available", WARM, A_AXIS, absBars, sim.a, 10, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
                ["pairwise against two references — three levels", GOOD, P_AXIS, pairBars, sim.p, 1, [0, 0.5, 1]],
              ] as const
            ).map(([label, col, axis, bs, m, hi, ticks]) => (
              <g key={label}>
                <text x={8} y={axis - 48} fontSize={9.5} fill={col} fontFamily="ui-monospace, monospace">
                  {label}
                </text>
                <text
                  x={AX1}
                  y={axis - 48}
                  fontSize={9}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity={0.5}
                  fontFamily="ui-monospace, monospace"
                >
                  {m.levels} of them used · {m.untied} of {m.total} pairs orderable
                </text>

                <line x1={AX0} y1={axis} x2={AX1} y2={axis} stroke="currentColor" strokeOpacity={0.25} />
                {ticks.map((t) => (
                  <g key={`${label}-${t}`}>
                    <line
                      x1={AX0 + (t / hi) * (AX1 - AX0)}
                      y1={axis}
                      x2={AX0 + (t / hi) * (AX1 - AX0)}
                      y2={axis + 4}
                      stroke="currentColor"
                      strokeOpacity={0.25}
                    />
                    <text
                      x={AX0 + (t / hi) * (AX1 - AX0)}
                      y={axis + 15}
                      fontSize={8}
                      textAnchor="middle"
                      fill="currentColor"
                      fillOpacity={0.42}
                      fontFamily="ui-monospace, monospace"
                    >
                      {t === 0.5 ? "0.5" : t}
                    </text>
                  </g>
                ))}
                {bs.map((b) => (
                  <g key={`${label}-b-${b.v}`}>
                    <rect x={b.x - 7} y={axis - b.h} width={14} height={b.h} rx={2} fill={col} fillOpacity={0.8} />
                    <text
                      x={b.x}
                      y={axis - b.h - 5}
                      fontSize={9}
                      textAnchor="middle"
                      fill={col}
                      fontFamily="ui-monospace, monospace"
                    >
                      {b.n}
                    </text>
                  </g>
                ))}
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              scale compression
            </span>
            <Range
              min={8}
              max={100}
              step={2}
              value={comp}
              onChange={(e) => setComp(Number(e.target.value))}
              className="flex-1"
              aria-label="how much of the zero to ten scale the absolute judge actually uses"
              accent={WARM}
            />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {(comp / 100).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              rollout spread
            </span>
            <Range
              min={2}
              max={20}
              step={1}
              value={spread}
              onChange={(e) => setSpread(Number(e.target.value))}
              className="flex-1"
              aria-label="how different the eight rollouts in the group are from each other"
              accent={ACCENT}
            />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              ±{(spread / 100).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              reference draw
            </span>
            <Range
              min={1}
              max={12}
              step={1}
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="flex-1"
              aria-label="which two references each rollout happens to be compared against"
              accent={MUTED}
            />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">#{seed}</span>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["absolute 0–10", sim.a, WARM, "eleven levels, spent on the bottom of the range"],
              ["pairwise", sim.p, GOOD, "three levels, and it uses them"],
            ] as const
          ).map(([l, m, c, note]) => (
            <div key={l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: c }}>
                  {l}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground">
                  {m.levels} level{m.levels === 1 ? "" : "s"} used
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-3">
                <div>
                  <div className="font-mono text-sm tabular-nums" style={{ color: c }}>
                    {m.tiedPct.toFixed(0)}%
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground">of pairs tied — no direction</div>
                </div>
                <div>
                  <div className="font-mono text-sm tabular-nums text-foreground">{pct(m)}</div>
                  <div className="font-mono text-[9px] text-muted-foreground">
                    {m.untied === 0 ? "nothing left to order" : "of the rest ordered correctly"}
                  </div>
                </div>
              </div>
              <div className="mt-1 font-mono text-[9px] text-muted-foreground">{note}</div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The pairwise reward has <em>fewer</em> possible values than the scale it replaced — two references means
          it can only ever be 0, 0.5 or 1. That should be a downgrade, and it is not, because{" "}
          <span className="text-foreground">GRPO does not read the scale, it reads the ranking within the group</span>.
          A group of eight rollouts contains {sim.a.total} pairs; every pair the reward assigns the same value to is
          a pair the update cannot learn anything from.
          <br />
          <br />
          Push the compression slider toward 1.0 and the absolute scale becomes the better instrument — which is
          exactly the point. Nothing was wrong with 0–10 as a scale. What was wrong was asking a judge model for an
          abstract magnitude and getting back the same two integers all day. The post&rsquo;s phrasing is worth
          keeping: the judge <em>&ldquo;handles a relative question more reliably than an abstract scale.&rdquo;</em>{" "}
          Dynamic range is a property of the answers, not of the scale.
        </p>
      </div>
    </figure>
  )
}

"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Strided window attention in LoL's routed core, computed from the paper's own
// rule (arXiv 2611.03526, Section 3.2.1 and Algorithm 1):
//   delta_l = (l - 1) * S mod W,   window of position i at depth l = floor((i + delta_l) / W)
// Every token in a window runs the same expert and attends causally inside
// that window only. The router for window k > 0 reads the mean of windows
// 0..k-1 at that depth; window 0 reads its first token plus a learned depth
// vector e(l). The expert labels here are illustrative (a fixed hash), not
// from a trained model; the window boundaries and the reach are exact.

const N = 16
const DEPTHS = 4
const COLORS = [
  "oklch(0.72 0.13 230)",
  "oklch(0.75 0.15 60)",
  "oklch(0.7 0.13 300)",
  "oklch(0.72 0.14 145)",
  "oklch(0.7 0.15 20)",
]

function windowOf(i: number, l: number, W: number, S: number) {
  const delta = ((l - 1) * S) % W
  return Math.floor((i + delta) / W)
}

// illustrative expert id for (depth, window): a small integer hash
function expertOf(l: number, k: number) {
  return (l * 7 + k * 3 + ((l * k) % 4)) % 5
}

export function StridedWindows() {
  const [W, setW] = useState(4)
  const [S, setS] = useState(2)
  const [tok, setTok] = useState(11)

  // reach[l] = set of positions that can influence `tok` after core depth l
  // (core only; the prelude's full attention is outside this picture)
  const reach = useMemo(() => {
    const out: Set<number>[] = []
    // backward: which inputs at depth-0 reach tok at depth l
    for (let L = 1; L <= DEPTHS; L++) {
      let cur = new Set<number>([tok])
      for (let l = L; l >= 1; l--) {
        const next = new Set<number>()
        cur.forEach((i) => {
          const w = windowOf(i, l, W, S)
          for (let j = 0; j <= i; j++) if (windowOf(j, l, W, S) === w) next.add(j)
        })
        cur = next
      }
      out.push(cur)
    }
    return out
  }, [W, S, tok])

  const sStep = Math.min(S, W - 1)
  const cell = 30
  const padL = 56
  const width = padL + N * cell + 8
  const rowH = 34
  const height = 22 + DEPTHS * rowH + 10

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">strided windows · paper Section 3.2.1</span>
        <span className="font-mono text-[10px] text-muted-foreground">click a token</span>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>window W</span>
              <span className="text-base font-semibold">{W}</span>
            </span>
            <Range min={2} max={8} step={1} value={W} onChange={(e) => {
              const w = Number(e.target.value)
              setW(w)
              if (S >= w) setS(Math.max(1, Math.floor(w / 2)))
            }} />
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>stride S</span>
              <span className="text-base font-semibold">{sStep}</span>
            </span>
            <Range min={0} max={W - 1} step={1} value={sStep} onChange={(e) => setS(Number(e.target.value))} />
          </label>
        </div>

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[520px]" role="img"
            aria-label={`Windows at four routed depths with W=${W} and S=${sStep}; token ${tok} is selected.`}>
            {Array.from({ length: N }, (_, i) => (
              <text key={i} x={padL + i * cell + cell / 2} y={14} textAnchor="middle"
                className={cn("fill-muted-foreground font-mono", i === tok && "fill-foreground font-semibold")} fontSize={10}>
                {i}
              </text>
            ))}
            {Array.from({ length: DEPTHS }, (_, d) => {
              const l = d + 1
              const y = 22 + d * rowH
              const delta = ((l - 1) * sStep) % W
              // group positions into windows
              const groups: { k: number; from: number; to: number }[] = []
              for (let i = 0; i < N; i++) {
                const k = windowOf(i, l, W, sStep)
                const g = groups[groups.length - 1]
                if (g && g.k === k) g.to = i
                else groups.push({ k, from: i, to: i })
              }
              const tokWin = windowOf(tok, l, W, sStep)
              return (
                <g key={l}>
                  <text x={4} y={y + 18} className="fill-muted-foreground font-mono" fontSize={10}>
                    {`depth ${l}`}
                  </text>
                  <text x={4} y={y + 29} className="fill-muted-foreground font-mono" fontSize={8}>
                    {`δ=${delta}`}
                  </text>
                  {groups.map((g, gi) => {
                    const e = expertOf(l, g.k)
                    const x = padL + g.from * cell + 1
                    const w = (g.to - g.from + 1) * cell - 2
                    const isRouterCtx = g.k < tokWin
                    return (
                      <g key={gi}>
                        <rect x={x} y={y} width={w} height={rowH - 8} rx={5}
                          fill={COLORS[e]} fillOpacity={g.k === tokWin ? 0.55 : isRouterCtx ? 0.28 : 0.14}
                          stroke={COLORS[e]} strokeWidth={g.k === tokWin ? 1.6 : 0.8} />
                        {w > 26 && (
                          <text x={x + 4} y={y + 10} fontSize={8} className="fill-foreground/70 font-mono">{`E${e + 1}`}</text>
                        )}
                      </g>
                    )
                  })}
                  {Array.from({ length: N }, (_, i) => {
                    const inReach = reach[d].has(i)
                    return (
                      <circle key={i} cx={padL + i * cell + cell / 2} cy={y + 17} r={i === tok ? 6 : 4.5}
                        onClick={() => setTok(i)} style={{ cursor: "pointer" }}
                        className={cn(inReach ? "fill-foreground" : "fill-muted-foreground/25")} />
                    )
                  })}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="grid gap-2 font-mono text-xs sm:grid-cols-3">
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">reach of token {tok}, core only</div>
            <div className="text-base font-semibold">
              {reach.map((r) => r.size).join(" → ")}
            </div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">windows per depth (n = {N})</div>
            <div className="text-base font-semibold">
              {Array.from({ length: DEPTHS }, (_, d) => {
                let k = 0
                for (let i = 0; i < N; i++) k = Math.max(k, windowOf(i, d + 1, W, sStep))
                return k + 1
              }).join(" · ")}
            </div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">router input, depth 1</div>
            <div className="text-base font-semibold">
              {windowOf(tok, 1, W, sStep) === 0 ? "first token + e(1)" : `mean of windows 0–${windowOf(tok, 1, W, sStep) - 1}`}
            </div>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Filled dots are the positions that can reach the selected token through the routed core alone. With S = 0 the
          boundaries never move and reach stops at one window; any nonzero stride lets it grow with depth. The bold window
          is the selected token&apos;s; the half-tinted ones to its left are what its router averages. Expert labels are
          illustrative, not from a trained model.
        </p>
      </div>
    </figure>
  )
}

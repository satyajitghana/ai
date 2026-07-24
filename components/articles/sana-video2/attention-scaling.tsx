"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Why SANA-Video 2.0 is fast, made draggable. Two levers compound. First the
// high-compression VAE (stride 8x32x32) collapses a clip into a modest token
// count N. Then attention cost scales in N: a full-softmax DiT pays O(N^2) at
// every layer, so cost explodes with resolution and duration; the 25%-hybrid
// keeps most layers linear (O(N)) with periodic softmax anchors, so its curve
// stays low and the gap widens the longer the video. Drag the length, flip the
// resolution, watch the two curves separate. The speedup is anchored to the
// paper's profiled DiT-forward points (1.55x at 5s -> 3.2x at 60s, 720p);
// magnitudes are illustrative — the shape is the point.

const GREEN = "oklch(0.62 0.15 152)" // SANA accent
const GRAY = "oklch(0.62 0.03 260)"

// tokens per latent frame after the 8x32x32 VAE (spatial 32x): W/32 * H/32
const TPF = { "480p": 390, "720p": 900 } as const
type Res = keyof typeof TPF
const LF_PER_S = 3 // ~24fps / temporal-stride 8

// illustrative cost model fit to the paper's two DiT-forward anchors:
// softmax ~ N^2, hybrid ~ K * N^P  =>  ratio(720p,5s)=1.55, ratio(720p,60s)=3.2
const P = 1.709
const K = 10.26
const sCost = (n: number) => n * n
const hCost = (n: number) => K * Math.pow(n, P)
const tokens = (t: number, res: Res) => TPF[res] * LF_PER_S * t

const TMIN = 5
const TMAX = 60
const W = 640
const H = 262
const PL = 30
const PB = 30
const PT = 16
const PR = 14

export function AttentionScaling() {
  const [t, setT] = useState(30)
  const [res, setRes] = useState<Res>("720p")

  const nAt = (k: number) => tokens(k, res)
  const yMax = sCost(nAt(TMAX)) // full softmax at longest clip = top of frame
  const x = (k: number) => PL + ((k - TMIN) / (TMAX - TMIN)) * (W - PL - PR)
  const y = (c: number) => PT + (1 - c / yMax) * (H - PT - PB)

  const n = nAt(t)
  const s = sCost(n)
  const h = hCost(n)
  const ratio = h > 0 ? s / h : 0

  const path = (f: (n: number) => number) =>
    Array.from({ length: TMAX - TMIN + 1 }, (_, i) => {
      const k = TMIN + i
      return `${i === 0 ? "M" : "L"} ${x(k).toFixed(2)} ${y(f(nAt(k))).toFixed(2)}`
    }).join(" ")

  // filled gap between the curves, up to the marker
  const gap = (() => {
    const up = Array.from({ length: t - TMIN + 1 }, (_, i) => {
      const k = TMIN + i
      return `${i === 0 ? "M" : "L"} ${x(k).toFixed(2)} ${y(sCost(nAt(k))).toFixed(2)}`
    }).join(" ")
    const down = Array.from({ length: t - TMIN + 1 }, (_, i) => {
      const k = t - i
      return `L ${x(k).toFixed(2)} ${y(hCost(nAt(k))).toFixed(2)}`
    }).join(" ")
    return `${up} ${down} Z`
  })()

  const ticks = [5, 20, 40, 60]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>attention cost vs. video length</span>
        <span className="text-muted-foreground/60">illustrative · anchored to the paper</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">{t}s clip · {res}</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {(n / 1000).toFixed(1)}k<span className="ml-1 text-xs font-normal text-muted-foreground">latent tokens</span>
            </div>
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <div className="font-mono text-[10px]" style={{ color: GRAY }}>full softmax · O(N²)</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: GRAY }}>{(s / yMax).toFixed(2)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px]" style={{ color: GREEN }}>25% hybrid</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: GREEN }}>{(h / yMax).toFixed(2)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">SANA is</div>
              <div className="font-mono text-xl font-semibold tabular-nums text-foreground">
                {ratio.toFixed(2)}×<span className="text-xs font-normal text-muted-foreground"> faster</span>
              </div>
            </div>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`For a ${t}-second ${res} clip (${(n / 1000).toFixed(1)}k latent tokens), the full-softmax DiT forward pass costs about ${ratio.toFixed(1)} times as much as SANA's 25% hybrid attention.`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <line key={g} x1={PL} x2={W - PR} y1={y(g * yMax)} y2={y(g * yMax)} stroke="currentColor" className="text-border" strokeWidth={1} opacity={g === 0 ? 1 : 0.5} />
          ))}

          {/* filled gap */}
          <path d={gap} fill={GREEN} opacity={0.1} />

          {/* curves */}
          <path d={path(sCost)} fill="none" stroke={GRAY} strokeWidth={2.5} strokeDasharray="5 4" strokeLinecap="round" />
          <path d={path(hCost)} fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinecap="round" />

          {/* labels riding the curves near the right edge */}
          <text x={W - PR - 2} y={y(sCost(nAt(TMAX))) + 14} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9} style={{ fill: GRAY }}>full softmax</text>
          <text x={W - PR - 2} y={y(hCost(nAt(TMAX))) - 6} textAnchor="end" className="font-mono" fontSize={9} style={{ fill: GREEN }}>25% hybrid</text>

          {/* marker */}
          <line x1={x(t)} x2={x(t)} y1={PT} y2={H - PB} stroke="currentColor" className="text-foreground/20" strokeWidth={1} />
          <circle cx={x(t)} cy={y(s)} r={4} fill={GRAY} stroke="var(--background)" strokeWidth={1.5} />
          <circle cx={x(t)} cy={y(h)} r={4} fill={GREEN} stroke="var(--background)" strokeWidth={1.5} />

          {/* x ticks */}
          {ticks.map((k) => (
            <text key={k} x={x(k)} y={H - PB + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{k}s</text>
          ))}
          <text x={(PL + W - PR) / 2} y={H - 3} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>video length →</text>
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">resolution</span>
            {(["480p", "720p"] as Res[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRes(r)}
                aria-pressed={res === r}
                className="cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors"
                style={res === r ? { background: GREEN, color: "oklch(0.18 0 0)" } : undefined}
              >
                <span className={res === r ? "" : "text-muted-foreground"}>{r}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            gap widens with <span className="text-foreground">length</span> and <span className="text-foreground">resolution</span>
          </div>
        </div>

        <label className="mt-3 block">
          <span className="sr-only">video length in seconds</span>
          <Range min={TMIN} max={TMAX} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full cursor-pointer" accent={GREEN} />
        </label>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The VAE hands the transformer only <span className="text-foreground">{(n / 1000).toFixed(1)}k</span> tokens for a{" "}
          {t}s {res} clip — but a full-softmax DiT still pays <span style={{ color: GRAY }}>O(N²)</span> on them at every
          layer, so its cost curls upward as the clip grows. SANA keeps three of every four layers{" "}
          <span style={{ color: GREEN }}>linear</span>, so its curve stays low and the speedup <span className="text-foreground">grows</span> with
          length and resolution — exactly where video hurts most.
        </p>
      </div>
    </figure>
  )
}

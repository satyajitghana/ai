"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10, mlog2, mpow } from "@/lib/dmath"

// Table 5's own numbers for Qwen3 14B<->32B, at each direction's selected k
// (k=8 small-to-large, k=20 large-to-small). Three measured sequence lengths
// per direction -- 64, 8,192, 32,768 tokens -- everything else on the curve
// is a smooth read between those three real points, not new data. Both axes
// are log-scaled (context length spans 64-32,768 = 2^6-2^15; latency spans
// ~12ms-~7,000ms), so a quadratic is fit in (log2 tokens, log10 ms) space
// through the three anchors -- three points determine a unique parabola, and
// because the anchors ARE the paper's measurements, the curve passes through
// every one of them exactly. The reader drags context length on that same
// log2 axis and reads back interpolated latency + speedup; only the three
// filled markers are measurements, everything else is a shape read between
// them, and the caption says so.
//
// Table 16 (Appendix G) extends this to seven pairs and confirms the paper's
// own headline: the mapper is faster in every one of the 70 measured cells
// across all pairs and lengths -- there's no crossover to show, and the
// prose next to this component says so explicitly rather than implying one.

type Dir = "sl" | "ls"

const MAPPER = "oklch(0.55 0.16 155)"
const REPREFILL = "oklch(0.62 0.05 260)"

// u = log2(tokens); these three are exact (64 = 2^6, 8192 = 2^13, 32768 = 2^15).
const ANCHORS_U = [6, 13, 15] as const

const DATA: Record<Dir, { label: string; k: string; mapper: number[]; reprefill: number[] }> = {
  sl: { label: "14B → 32B", k: "8", mapper: [14.0, 67.8, 277.6], reprefill: [61.7, 1154.8, 6975.3] },
  ls: { label: "32B → 14B", k: "20", mapper: [11.6, 101.9, 427.1], reprefill: [39.2, 501.0, 2952.7] },
}

// Exact quadratic through 3 points via Lagrange basis -- +,-,*,/ only, no
// transcendentals, so no dmath needed for the fit itself.
function fitQuadratic(us: readonly number[], ys: number[]) {
  const [u1, u2, u3] = us
  const [y1, y2, y3] = ys
  return (u: number) => {
    const l1 = ((u - u2) * (u - u3)) / ((u1 - u2) * (u1 - u3))
    const l2 = ((u - u1) * (u - u3)) / ((u2 - u1) * (u2 - u3))
    const l3 = ((u - u1) * (u - u2)) / ((u3 - u1) * (u3 - u2))
    return y1 * l1 + y2 * l2 + y3 * l3
  }
}

const W = 720
const H = 300
const PL = 52
const PR = 16
const PT = 16
const PB = 30
const U_MIN = 6 // 64 tokens
const U_MAX = 15 // 32,768 tokens
const LOG_MS_MIN = 1 // 10 ms
const LOG_MS_MAX = 3.9 // ~7,940 ms

export function CostCurve() {
  const [dir, setDir] = useState<Dir>("sl")
  const [u, setU] = useState(11) // slider lives in log2(tokens) space

  const d = DATA[dir]
  const mapperLogY = d.mapper.map((ms) => mlog10(ms))
  const reprefillLogY = d.reprefill.map((ms) => mlog10(ms))
  const mapperFit = fitQuadratic(ANCHORS_U, mapperLogY)
  const reprefillFit = fitQuadratic(ANCHORS_U, reprefillLogY)

  const x = (uVal: number) => PL + ((uVal - U_MIN) / (U_MAX - U_MIN)) * (W - PL - PR)
  const y = (logMs: number) => PT + (1 - (logMs - LOG_MS_MIN) / (LOG_MS_MAX - LOG_MS_MIN)) * (H - PT - PB)

  const path = (fit: (u: number) => number) => {
    const N = 80
    let d2 = ""
    for (let i = 0; i <= N; i++) {
      const uu = U_MIN + (i / N) * (U_MAX - U_MIN)
      d2 += `${i === 0 ? "M" : "L"} ${x(uu).toFixed(1)} ${y(fit(uu)).toFixed(1)} `
    }
    return d2.trim()
  }

  const tokensAtU = mpow(2, u)
  const mapperMsAtU = mpow(10, mapperFit(u))
  const reprefillMsAtU = mpow(10, reprefillFit(u))
  const speedupAtU = reprefillMsAtU / mapperMsAtU
  const isAnchor = ANCHORS_U.some((a) => Math.abs(a - u) < 0.02)

  const tickTokens = [64, 256, 1024, 4096, 16384, 32768]
  const tickMs = [10, 100, 1000]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">prefill vs. map latency &middot; Qwen3 14B&harr;32B (paper, Table 5)</span>
        <div className="flex gap-1.5">
          {(
            [
              ["sl", "small → large"],
              ["ls", "large → small"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setDir(k)}
              aria-pressed={dir === k}
              className={
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors " +
                (dir === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">context length</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-foreground">
              {tokensAtU >= 1000 ? `${(tokensAtU / 1000).toFixed(tokensAtU >= 10000 ? 0 : 1)}K` : Math.round(tokensAtU)} tok
              {isAnchor ? <span className="ml-1.5 font-mono text-[9px] font-normal text-muted-foreground">measured</span> : <span className="ml-1.5 font-mono text-[9px] font-normal text-muted-foreground">interpolated</span>}
            </div>
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <div className="font-mono text-[10px]" style={{ color: MAPPER }}>mapper</div>
              <div className="font-mono text-lg font-semibold tabular-nums" style={{ color: MAPPER }}>{mapperMsAtU.toFixed(1)} ms</div>
            </div>
            <div>
              <div className="font-mono text-[10px]" style={{ color: REPREFILL }}>re-prefill</div>
              <div className="font-mono text-lg font-semibold tabular-nums" style={{ color: REPREFILL }}>{reprefillMsAtU.toFixed(1)} ms</div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">mapper is</div>
              <div className="font-mono text-lg font-semibold tabular-nums text-foreground">{speedupAtU.toFixed(1)}&times;</div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            className="min-w-[560px] max-w-full"
            role="img"
            aria-label={`Log-log plot of latency versus context length for ${d.label}. Both re-prefill and mapper latency grow with context length, but re-prefill grows faster, so the mapper's speed advantage widens from about 3 to 4 times at 64 tokens to 17 to 25 times at 32,768 tokens. The mapper is faster at every measured point; no crossover appears in the tested range.`}
          >
            {tickMs.map((ms) => (
              <g key={ms}>
                <line x1={PL} x2={W - PR} y1={y(mlog10(ms))} y2={y(mlog10(ms))} stroke="currentColor" className="text-border" strokeWidth={1} strokeDasharray="2 3" />
                <text x={PL - 6} y={y(mlog10(ms)) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8.5}>
                  {ms}
                </text>
              </g>
            ))}
            <text x={14} y={PT + 6} className="fill-muted-foreground font-mono" fontSize={8.5} transform={`rotate(-90 14 ${(PT + H - PB) / 2})`} textAnchor="middle">
              ms (log)
            </text>

            {tickTokens.map((t) => (
              <g key={t}>
                <line x1={x(mlog2(t))} x2={x(mlog2(t))} y1={PT} y2={H - PB} stroke="currentColor" className="text-border" strokeWidth={1} strokeOpacity={0.3} />
                <text x={x(mlog2(t))} y={H - PB + 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>
                  {t >= 1024 ? `${t / 1024}K` : t}
                </text>
              </g>
            ))}
            <text x={(PL + W - PR) / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>
              context length, tokens (log)
            </text>

            <path d={path(reprefillFit)} fill="none" stroke={REPREFILL} strokeWidth={2.4} strokeLinecap="round" />
            <path d={path(mapperFit)} fill="none" stroke={MAPPER} strokeWidth={2.4} strokeLinecap="round" />

            {ANCHORS_U.map((au, i) => (
              <g key={au}>
                <circle cx={x(au)} cy={y(reprefillLogY[i])} r={3.5} fill={REPREFILL} stroke="var(--background)" strokeWidth={1.3} />
                <circle cx={x(au)} cy={y(mapperLogY[i])} r={3.5} fill={MAPPER} stroke="var(--background)" strokeWidth={1.3} />
                <text x={x(au)} y={y(reprefillLogY[i]) - 8} textAnchor="middle" className="font-mono" fontSize={9} fill={REPREFILL}>
                  {(d.reprefill[i] / d.mapper[i]).toFixed(0)}&times;
                </text>
              </g>
            ))}

            <line x1={x(u)} x2={x(u)} y1={PT} y2={H - PB} stroke="currentColor" className="text-foreground/25" strokeWidth={1} strokeDasharray={isAnchor ? undefined : "3 3"} />
            <circle cx={x(u)} cy={y(reprefillFit(u))} r={4.5} fill="none" stroke={REPREFILL} strokeWidth={1.6} />
            <circle cx={x(u)} cy={y(mapperFit(u))} r={4.5} fill="none" stroke={MAPPER} strokeWidth={1.6} />
          </svg>
        </div>

        <label className="mt-1 block">
          <span className="sr-only">context length (log scale)</span>
          <Range min={U_MIN} max={U_MAX} step={0.05} value={u} onChange={(e) => setU(Number(e.target.value))} className="w-full cursor-pointer" accent={MAPPER} />
        </label>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: MAPPER }} /> mapper application</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: REPREFILL }} /> target re-prefill</span>
          <span>&middot; filled circles = measured (64 / 8K / 32K tok, k={d.k}) &middot; open circle = interpolated reader marker</span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Both curves rise with context length, but re-prefill rises faster — the gap between{" "}
          <span style={{ color: REPREFILL }}>re-prefill</span> and{" "}
          <span style={{ color: MAPPER }}>the mapper</span> widens from{" "}
          {dir === "sl" ? "4× at 64 tokens to 25× at 32,768" : "3× at 64 tokens to 7× at 32,768"}, all
          within the range the paper actually measured. Nowhere in that range does re-prefill catch up: across all
          seven pairs and ten sequence lengths in Appendix G, the mapper is faster in <strong>every one of 70 measured
          cells</strong> — there is no observed crossover to find, only a gap that keeps growing with context length
          and, separately, with how many source layers a pair&rsquo;s selected <em>k</em> concatenates (a bigger k
          means a heavier per-token matmul, which is part of why Llama 3.1 8B&nbsp;&rarr;&nbsp;70B&rsquo;s k=20 tops
          out lower than this pair&rsquo;s k=8 despite transferring into a much larger target).
        </p>
      </div>
    </figure>
  )
}

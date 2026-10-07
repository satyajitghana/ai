"use client"

import { useId, useState } from "react"

import { cn } from "@/lib/utils"

// Upper bounds on the matrix multiplication exponent ω, 1969–2026, with the
// three openai/math family-107 claims drawn as claims (hollow, dashed) and the
// two best-known barrier lines for the Coppersmith–Winograd route.
//
// Published values are the ones each paper states (and that later papers in
// the line quote): Strassen 1969 log2 7; Pan 1978; Bini–Capovani–Lotti–Romani
// 1979; Schönhage 1981; Romani 1982; Coppersmith–Winograd 1982 and 1990;
// Strassen 1986 (laser method); Stothers 2010; Vassilevska Williams 2012;
// Le Gall 2014 (arXiv:1401.7714); Alman–Vassilevska Williams 2021
// (arXiv:2010.05846); Duan–Wu–Zhou 2023 (arXiv:2210.10173); Vassilevska
// Williams–Xu–Xu–Zhou 2024 (arXiv:2307.07970); Alman–Duan–Vassilevska
// Williams–Xu–Xu–Zhou 2025 (arXiv:2404.16349); Dupont et al. 2026
// (arXiv:2608.16884). Claims: openai/math preprints dated 24 Sep and 2 Oct 2026.
// Barriers: Ambainis–Filmus–Le Gall (arXiv:1411.5414) 2.3078 for a wide class
// of laser-method variants on CW powers; Alman (arXiv:1812.08731) 2.16805 for
// the universal method on any CW_q (equal to 2 × the irreversibility of CW_1).

type Pt = {
  y: number
  w: number
  who: string
  note: string
  claim?: boolean
}

const PTS: Pt[] = [
  { y: 1969, w: 2.807355, who: "Strassen", note: "7 products for 2×2 blocks: log2 7" },
  { y: 1978, w: 2.795, who: "Pan", note: "trilinear aggregation" },
  { y: 1979, w: 2.7799, who: "Bini, Capovani, Lotti, Romani", note: "border rank (approximate algorithms)" },
  { y: 1981, w: 2.522, who: "Schönhage", note: "asymptotic sum inequality" },
  { y: 1982, w: 2.517, who: "Romani", note: "" },
  { y: 1982.5, w: 2.496, who: "Coppersmith, Winograd", note: "" },
  { y: 1986, w: 2.479, who: "Strassen", note: "the laser method" },
  { y: 1990, w: 2.375477, who: "Coppersmith, Winograd", note: "CW tensor, Salem–Spencer sets, square of CW" },
  { y: 2010, w: 2.3737, who: "Stothers", note: "4th power of CW" },
  { y: 2012, w: 2.3729, who: "Vassilevska Williams", note: "8th power" },
  { y: 2014, w: 2.3728639, who: "Le Gall", note: "32nd power, convex optimisation" },
  { y: 2020.8, w: 2.3728596, who: "Alman, Vassilevska Williams", note: "refined laser method" },
  { y: 2022.8, w: 2.371866, who: "Duan, Wu, Zhou", note: "asymmetric hashing" },
  { y: 2023.5, w: 2.371552, who: "Vassilevska Williams, Xu, Xu, Zhou", note: "from alpha to omega" },
  { y: 2024.3, w: 2.371339, who: "Alman, Duan, Vassilevska Williams, Xu, Xu, Zhou", note: "more asymmetry" },
  { y: 2026.6, w: 2.371177, who: "Dupont et al.", note: "same framework, 8th power, AlphaEvolve-tuned parameters" },
  {
    y: 2026.73,
    w: 2.371054886,
    who: "openai/math (claim)",
    note: "every fixed field, incl. positive characteristic; staggered extraction on CW_5",
    claim: true,
  },
  {
    y: 2026.73,
    w: 2.258,
    who: "openai/math (claim)",
    note: "characteristic 0 (and all but finitely many p); group-tensor label separation on CW_1",
    claim: true,
  },
  {
    y: 2026.75,
    w: 2.25,
    who: "openai/math (claim)",
    note: "over ℂ: 9/4 via tensor characters and polynomial multiplication",
    claim: true,
  },
]

const BARRIERS = [
  { w: 2.3078, label: "Ambainis–Filmus–Le Gall: laser-method variants on CW powers" },
  { w: 2.16805, label: "Alman / Christandl–Vrana–Zuiddam: any method through a CW tensor" },
]

const W = 680
const H = 340
const L = 56
const R = 16
const T = 14
const B = 34

type View = "all" | "modern" | "tail"

const VIEWS: Record<View, { x0: number; x1: number; w0: number; w1: number; label: string }> = {
  all: { x0: 1966, x1: 2029, w0: 2.0, w1: 3.0, label: "1969–2026" },
  modern: { x0: 1986, x1: 2029, w0: 2.1, w1: 2.5, label: "laser-method era" },
  tail: { x0: 2009, x1: 2027.5, w0: 2.3710, w1: 2.3740, label: "the last 0.003" },
}

function fmt(w: number) {
  return w >= 2.37 ? w.toFixed(6) : w.toFixed(4)
}

export function OmegaTimeline() {
  const clipId = useId().replace(/:/g, "")
  const [view, setView] = useState<View>("all")
  const [showClaims, setShowClaims] = useState(true)
  const [showBarriers, setShowBarriers] = useState(true)
  const [sel, setSel] = useState<number>(PTS.length - 1)
  const v = VIEWS[view]
  const sx = (y: number) => L + ((y - v.x0) / (v.x1 - v.x0)) * (W - L - R)
  const sy = (w: number) => T + ((v.w1 - w) / (v.w1 - v.w0)) * (H - T - B)
  const inView = (p: Pt) => p.w >= v.w0 && p.w <= v.w1 && p.y >= v.x0 && p.y <= v.x1
  const pub = PTS.filter((p) => !p.claim)
  const step: string[] = []
  pub.forEach((p, i) => {
    const x = sx(p.y)
    const y = sy(Math.min(Math.max(p.w, v.w0), v.w1))
    if (i === 0) step.push(`M${x.toFixed(1)},${y.toFixed(1)}`)
    else {
      const prevY = sy(Math.min(Math.max(pub[i - 1].w, v.w0), v.w1))
      step.push(`L${x.toFixed(1)},${prevY.toFixed(1)}`, `L${x.toFixed(1)},${y.toFixed(1)}`)
    }
  })
  step.push(`L${sx(v.x1).toFixed(1)},${sy(Math.min(Math.max(pub[pub.length - 1].w, v.w0), v.w1)).toFixed(1)}`)
  const ticksW: number[] = []
  const span = v.w1 - v.w0
  const dw = span > 0.5 ? 0.1 : span > 0.2 ? 0.05 : 0.0005
  for (let w = Math.ceil(v.w0 / dw - 1e-9) * dw; w <= v.w1 + 1e-9; w += dw) ticksW.push(Number(w.toFixed(4)))
  const ticksY: number[] = []
  const dy = v.x1 - v.x0 > 40 ? 10 : 5
  for (let y = Math.ceil(v.x0 / dy) * dy; y <= v.x1; y += dy) ticksY.push(y)
  const p = PTS[sel]

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4 text-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(Object.keys(VIEWS) as View[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setView(k)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              view === k ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
            )}
          >
            {VIEWS[k].label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <input type="checkbox" checked={showClaims} onChange={(e) => setShowClaims(e.target.checked)} />
          claims
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input type="checkbox" checked={showBarriers} onChange={(e) => setShowBarriers(e.target.checked)} />
          barriers
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Upper bounds on omega by year, with the openai/math claims marked as claims">
        {ticksW.map((w) => (
          <g key={`w${w}`}>
            <line x1={L} x2={W - R} y1={sy(w)} y2={sy(w)} stroke="currentColor" strokeOpacity={0.08} />
            <text x={L - 6} y={sy(w) + 3} textAnchor="end" fontSize={10} fill="currentColor" fillOpacity={0.6}>
              {span < 0.01 ? w.toFixed(4) : w.toFixed(2)}
            </text>
          </g>
        ))}
        {ticksY.map((y) => (
          <text key={`y${y}`} x={sx(y)} y={H - B + 16} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.6}>
            {y}
          </text>
        ))}
        <text x={14} y={T + (H - T - B) / 2} fontSize={11} fill="currentColor" transform={`rotate(-90 14 ${T + (H - T - B) / 2})`} textAnchor="middle">
          upper bound on ω
        </text>
        {showBarriers &&
          BARRIERS.filter((b) => b.w >= v.w0 && b.w <= v.w1).map((b) => (
            <g key={b.w}>
              <line x1={L} x2={W - R} y1={sy(b.w)} y2={sy(b.w)} stroke="oklch(0.60 0.18 25)" strokeDasharray="2 4" strokeWidth={1.2} />
              <text x={L + 4} y={sy(b.w) - 4} fontSize={9.5} fill="oklch(0.60 0.18 25)">
                {b.w} {b.label}
              </text>
            </g>
          ))}
        {v.w0 <= 2 && (
          <text x={W - R - 4} y={sy(2) - 4} fontSize={9.5} textAnchor="end" fill="currentColor" fillOpacity={0.6}>
            ω ≥ 2 (output size)
          </text>
        )}
        <defs>
          <clipPath id={`plot${clipId}`}>
            <rect x={L} y={0} width={W - L - R} height={H - B} />
          </clipPath>
        </defs>
        <path d={step.join(" ")} fill="none" stroke="oklch(0.55 0.15 250)" strokeWidth={1.8} clipPath={`url(#plot${clipId})`} />
        {PTS.map((q, i) => {
          if (!inView(q) || (q.claim && !showClaims)) return null
          const cx = sx(q.y)
          const cy = sy(q.w)
          return (
            <g key={i} onClick={() => setSel(i)} onMouseEnter={() => setSel(i)} style={{ cursor: "pointer" }}>
              <circle cx={cx} cy={cy} r={10} fill="transparent" />
              {q.claim ? (
                <circle cx={cx} cy={cy} r={5} fill="var(--background, white)" stroke="oklch(0.70 0.17 60)" strokeWidth={2} strokeDasharray="2 1.5" />
              ) : (
                <circle cx={cx} cy={cy} r={i === sel ? 5 : 3.6} fill="oklch(0.55 0.15 250)" />
              )}
            </g>
          )
        })}
      </svg>
      <div className="mt-2 min-h-[3.5rem] rounded-lg bg-muted/50 p-3">
        <div className="font-medium">
          {Math.floor(p.y)} · {p.who} · ω {p.claim ? "<" : "≤"} {fmt(p.w)}
          {p.claim && (
            <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-300">claim, not yet refereed</span>
          )}
        </div>
        {p.note && <div className="text-muted-foreground">{p.note}</div>}
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Filled dots are published bounds; hollow dashed dots are the three openai/math claims (Lean-checked per the release, not refereed). Switch to “the last 0.003” to see how small the published steps have been since 2010. Red lines are proved limits of the Coppersmith–Winograd route; the 9/4 argument does not go through that route.
      </figcaption>
    </figure>
  )
}

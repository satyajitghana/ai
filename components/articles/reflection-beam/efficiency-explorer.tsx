"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Reflection's "reasoning efficiency" charts, rebuilt from their own points.
// Every (tokens, score) pair below was read off the blog's "Score against mean
// generated tokens" figure by locating each dot's pixel centre and mapping it
// through the axis gridlines (measured, roughly ±0.5k tokens and ±0.5 points).
// The FLOP axis is not read off the other chart; it is recomputed with the
// blog's own formula, FLOPs = 2 x active params x mean generated tokens, and
// it lands within ~3% of where Reflection's FLOP chart draws the same dots.
// Plain arithmetic only (no transcendental Math), so SSR and client agree.

type Pt = { tok: number; score: number } // tok in thousands, score in %
type Bench = { key: string; label: string; beam: Pt[]; glm: Pt[]; yMin: number; yMax: number }

const BENCHES: Bench[] = [
  {
    key: "deepswe",
    label: "DeepSWE v1.1",
    beam: [
      { tok: 10.4, score: 5.9 },
      { tok: 14.7, score: 14.7 },
      { tok: 19.3, score: 21.9 },
      { tok: 28.2, score: 32.4 },
      { tok: 35.4, score: 38.0 },
      { tok: 43.1, score: 44.3 },
    ],
    glm: [
      { tok: 54.0, score: 36.1 },
      { tok: 77.8, score: 43.7 },
    ],
    yMin: 0,
    yMax: 50,
  },
  {
    key: "hle",
    label: "HLE (text-only)",
    beam: [
      { tok: 6.2, score: 28.6 },
      { tok: 8.7, score: 30.8 },
      { tok: 11.5, score: 32.9 },
      { tok: 14.7, score: 34.4 },
      { tok: 16.9, score: 35.1 },
      { tok: 19.4, score: 35.7 },
    ],
    glm: [{ tok: 40.7, score: 41.0 }],
    yMin: 25,
    yMax: 45,
  },
  {
    key: "tb",
    label: "Terminal Bench 2.1",
    beam: [
      { tok: 7.2, score: 64.0 },
      { tok: 9.9, score: 70.1 },
      { tok: 12.6, score: 73.2 },
      { tok: 16.9, score: 76.2 },
      { tok: 20.6, score: 76.7 },
      { tok: 23.5, score: 79.4 },
    ],
    glm: [{ tok: 81.0, score: 77.6 }],
    yMin: 60,
    yMax: 85,
  },
]

const N_BEAM = 23 // B active
const N_GLM = 40 // B active (GLM-5.2: 744B total, 40B active)

// 2 * N(B) * tokens(k) = PFLOP * 1e3 ... 2 * N e9 * t e3 = 2*N*t e12 = 2*N*t/1000 PFLOP
const pflop = (n: number, tok: number) => (2 * n * tok) / 1000

const BEAM = "#3f6212"
const GLM = "#ea580c"

const W = 640
const H = 300
const PL = 46
const PR = 16
const PT = 16
const PB = 40

export function EfficiencyExplorer() {
  const [bi, setBi] = useState(2)
  const [axis, setAxis] = useState<"tok" | "flop">("flop")
  const b = BENCHES[bi]
  const [ei, setEi] = useState(b.beam.length - 1)
  const e = Math.min(ei, b.beam.length - 1)

  const xOf = (p: Pt, n: number) => (axis === "tok" ? p.tok : pflop(n, p.tok))
  const xMax = axis === "tok" ? 90 : 7
  const xTicks = axis === "tok" ? [0, 20, 40, 60, 80] : [0, 1, 2, 3, 4, 5, 6, 7]
  const sx = (v: number) => PL + (v / xMax) * (W - PL - PR)
  const sy = (s: number) => PT + (1 - (s - b.yMin) / (b.yMax - b.yMin)) * (H - PT - PB)
  const yStep = b.yMax - b.yMin > 30 ? 10 : 5
  const yTicks: number[] = []
  for (let y = b.yMin; y <= b.yMax; y += yStep) yTicks.push(y)

  const pick = b.beam[e]
  const ref = b.glm[b.glm.length - 1] // GLM-5.2's highest-effort point
  const matched = pick.score >= ref.score
  const tokRatio = ref.tok / pick.tok
  const flopRatio = pflop(N_GLM, ref.tok) / pflop(N_BEAM, pick.tok)

  const line = (pts: Pt[], n: number) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(xOf(p, n)).toFixed(1)} ${sy(p.score).toFixed(1)}`).join(" ")

  const unit = axis === "tok" ? "k tokens" : "PFLOP"
  const fmtX = (p: Pt, n: number) => (axis === "tok" ? `${p.tok.toFixed(1)}k` : pflop(n, p.tok).toFixed(2))

  return (
    <figure className="my-8 rounded-xl border bg-gradient-to-b from-muted/15 to-transparent p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Beam vs GLM-5.2, rebuilt from Reflection&apos;s points</div>
        <div className="flex flex-wrap gap-1">
          {BENCHES.map((x, i) => (
            <button
              key={x.key}
              type="button"
              onClick={() => {
                setBi(i)
                setEi(x.beam.length - 1)
              }}
              className={`rounded-md border px-2 py-0.5 font-mono text-xs ${i === bi ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1 font-mono text-xs">
        <span className="self-center text-muted-foreground">x-axis:</span>
        <button type="button" onClick={() => setAxis("tok")} className={`rounded-md border px-2 py-0.5 ${axis === "tok" ? "bg-foreground text-background" : "text-muted-foreground"}`}>
          mean generated tokens
        </button>
        <button type="button" onClick={() => setAxis("flop")} className={`rounded-md border px-2 py-0.5 ${axis === "flop" ? "bg-foreground text-background" : "text-muted-foreground"}`}>
          2 x active x tokens (PFLOP)
        </button>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`${b.label}: score against ${unit} for Beam's effort levels and GLM-5.2`}>
        {yTicks.map((y) => (
          <g key={`y${y}`}>
            <line x1={PL} x2={W - PR} y1={sy(y)} y2={sy(y)} stroke="currentColor" strokeOpacity={0.1} />
            <text x={PL - 6} y={sy(y) + 4} textAnchor="end" fontSize={11} className="fill-muted-foreground font-mono">
              {y}%
            </text>
          </g>
        ))}
        {xTicks.map((x) => (
          <g key={`x${x}`}>
            <line x1={sx(x)} x2={sx(x)} y1={PT} y2={H - PB} stroke="currentColor" strokeOpacity={0.08} />
            <text x={sx(x)} y={H - PB + 16} textAnchor="middle" fontSize={11} className="fill-muted-foreground font-mono">
              {axis === "tok" && x > 0 ? `${x}k` : x}
            </text>
          </g>
        ))}
        <text x={(PL + W - PR) / 2} y={H - 6} textAnchor="middle" fontSize={11} className="fill-muted-foreground font-mono">
          {axis === "tok" ? "mean generated tokens per attempt" : "estimated generation FLOPs per attempt (PFLOP)"}
        </text>

        <path d={line(b.glm, N_GLM)} fill="none" stroke={GLM} strokeWidth={2} />
        {b.glm.map((p, i) => (
          <circle key={`g${i}`} cx={sx(xOf(p, N_GLM))} cy={sy(p.score)} r={5} fill={GLM} />
        ))}
        <path d={line(b.beam, N_BEAM)} fill="none" stroke={BEAM} strokeWidth={2} />
        {b.beam.map((p, i) => (
          <circle key={`b${i}`} cx={sx(xOf(p, N_BEAM))} cy={sy(p.score)} r={i === e ? 7 : 4} fill={BEAM} stroke={i === e ? "white" : "none"} strokeWidth={2} />
        ))}
        <line x1={sx(xOf(pick, N_BEAM))} x2={sx(xOf(ref, N_GLM))} y1={sy(ref.score)} y2={sy(ref.score)} stroke={GLM} strokeDasharray="4 4" strokeOpacity={0.6} />
      </svg>

      <label className="mt-2 block text-xs text-muted-foreground">
        Beam reasoning effort: level <strong className="font-mono text-foreground">{e + 1}</strong> of {b.beam.length}
        <Range min={0} max={b.beam.length - 1} step={1} value={e} onChange={(ev) => setEi(Number(ev.target.value))} accent={BEAM} aria-label="Beam reasoning effort level" className="mt-1 w-full" />
      </label>

      <figcaption className="mt-3 grid gap-x-6 gap-y-1 font-mono text-xs text-muted-foreground sm:grid-cols-2">
        <span>
          <span style={{ color: BEAM }}>Beam</span>: <strong className="text-foreground">{pick.score.toFixed(1)}%</strong> at {fmtX(pick, N_BEAM)} {axis === "flop" ? "PFLOP" : "tokens"}
        </span>
        <span>
          <span style={{ color: GLM }}>GLM-5.2</span>: <strong className="text-foreground">{ref.score.toFixed(1)}%</strong> at {fmtX(ref, N_GLM)} {axis === "flop" ? "PFLOP" : "tokens"}
        </span>
        <span>
          GLM spends <strong className="text-foreground">{tokRatio.toFixed(1)}x</strong> the tokens, <strong className="text-foreground">{flopRatio.toFixed(1)}x</strong> the FLOPs
        </span>
        <span>{matched ? "a matched comparison: Beam scores at least as high here" : `not matched: Beam is ${(ref.score - pick.score).toFixed(1)} points lower here`}</span>
      </figcaption>
    </figure>
  )
}

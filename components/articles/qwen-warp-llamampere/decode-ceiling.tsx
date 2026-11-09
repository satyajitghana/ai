"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The bus ceiling for one decode cycle: tok/s <= L x B x e / D.
//
//   D  GB read from VRAM per cycle (one verify pass plus the drafter)
//   B  peak memory bandwidth of the card (RTX 3090 936 GB/s, RTX 5090 1,792 GB/s)
//   e  share of the peak the kernels reach (slider)
//   L  tokens committed per cycle
//
// D for qwen-warp is my count from the safetensors headers of ukisai/Swift-1.5-Qwen3.8-27b-INT4 (range requests):
//   decoder layers, W4 packed + bf16 scales          12.596 GB
//   int4 lm_head (248,320 x 5,120) + scales           0.656 GB
//   gated-DeltaNet state, fp32, read + written         0.302 GB (48 layers x 48 heads x 128 x 128 x 4 B x 2)
//   = one verify pass                                 13.554 GB
//   MTP k = 3: 3 x (MTP layer at int4 0.216 + 64k-row draft head 0.173)  -> 14.720 GB a cycle
//   DFlash2: verify + the 1.0 GiB W4 drafter                              -> 14.627 GB a cycle
// YASAKANI publishes no code; 11.7 GB is the size of its fast model file, taken as D (a cycle may read less).
// Reported points are from qwen-warp's docs/PERFORMANCE.md (tokens per cycle as it states them).

type Point = { l: number; v: number; label: string }
type Preset = {
  key: string
  label: string
  bw: number
  d: number
  points: Point[]
  lines: { v: number; label: string }[]
}

const PRESETS: Preset[] = [
  {
    key: "mtp",
    label: "qwen-warp · MTP k=3 · 3090",
    bw: 936,
    d: 14.72,
    points: [{ l: 3.5, v: 181, label: "short code 181" }],
    lines: [],
  },
  {
    key: "df",
    label: "qwen-warp · DFlash2 · 3090",
    bw: 936,
    d: 14.63,
    points: [{ l: 5.9, v: 276.7, label: "code 276.7" }],
    lines: [{ v: 296, label: "post: 296" }],
  },
  {
    key: "yas",
    label: "YASAKANI · 5090 · no code",
    bw: 1792,
    d: 11.7,
    points: [],
    lines: [
      { v: 1220, label: "JSONL 1,220" },
      { v: 424, label: "prose 424" },
    ],
  },
]

const ACCENT = "oklch(0.55 0.16 250)"
const POINT = "oklch(0.60 0.17 30)"
const LINE = "oklch(0.58 0.19 28)"

const W = 720
const H = 300
const PL = 52
const PR = 120
const PT = 18
const PB = 40
const PW = W - PL - PR
const PH = H - PT - PB
const L_MAX = 10

function niceMax(v: number) {
  const steps = [100, 200, 250, 400, 500, 800, 1000, 1500, 2000]
  for (const s of steps) if (v <= s) return s
  return Math.ceil(v / 500) * 500
}

export function DecodeCeiling() {
  const [key, setKey] = useState("df")
  const [eff, setEff] = useState(0.84)
  const p = PRESETS.find((x) => x.key === key) ?? PRESETS[0]

  const perL = (p.bw * eff) / p.d // tok/s per committed token
  const yMax = niceMax(Math.max(perL * L_MAX, ...p.lines.map((x) => x.v * 1.1), ...p.points.map((x) => x.v * 1.1)))
  const x = (l: number) => PL + ((l - 0) / L_MAX) * PW
  const y = (v: number) => PT + PH - (v / yMax) * PH
  const peak = p.bw / p.d
  const ticksY = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * yMax))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the bus ceiling · bytes per cycle counted from the checkpoint headers, speeds as reported
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        {PRESETS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setKey(s.key)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              key === s.key ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="px-2 pt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Ceiling for ${p.label}: ${perL.toFixed(1)} tokens per second for each token committed per cycle at ${(eff * 100).toFixed(0)} percent of ${p.bw} GB per second, with ${p.d} GB read per cycle.`}
        >
          {ticksY.map((t) => (
            <g key={t}>
              <line x1={PL} x2={PL + PW} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.08} />
              <text x={PL - 6} y={y(t) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
                {t}
              </text>
            </g>
          ))}
          {[0, 2, 4, 6, 8, 10].map((t) => (
            <text key={t} x={x(t)} y={PT + PH + 14} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
              {t}
            </text>
          ))}
          <text x={PL + PW / 2} y={H - 6} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
            tokens committed per cycle (L)
          </text>
          <text x={12} y={PT + PH / 2} fontSize={10} className="fill-muted-foreground font-mono" transform={`rotate(-90 12 ${PT + PH / 2})`} textAnchor="middle">
            tok/s
          </text>

          {/* the 100% bus line, faint, and the chosen-efficiency line */}
          <line x1={x(0)} y1={y(0)} x2={x(L_MAX)} y2={y(Math.min(yMax, peak * L_MAX))} stroke={ACCENT} strokeOpacity={0.25} strokeDasharray="4 4" />
          <line x1={x(0)} y1={y(0)} x2={x(L_MAX)} y2={y(Math.min(yMax, perL * L_MAX))} stroke={ACCENT} strokeWidth={2} />
          <text x={PL + PW + 6} y={y(Math.min(yMax, perL * L_MAX)) + 4} fontSize={10} fill={ACCENT} className="font-mono">
            {(eff * 100).toFixed(0)}% of bus
          </text>

          {p.lines.map((ln) => (
            <g key={ln.label}>
              <line x1={PL} x2={PL + PW} y1={y(ln.v)} y2={y(ln.v)} stroke={LINE} strokeDasharray="2 3" />
              <text x={PL + PW + 6} y={y(ln.v) + 4} fontSize={10} fill={LINE} className="font-mono">
                {ln.label}
              </text>
              <circle cx={x(ln.v / perL)} cy={y(ln.v)} r={3} fill="none" stroke={LINE} />
            </g>
          ))}
          {p.points.map((pt) => (
            <g key={pt.label}>
              <circle cx={x(pt.l)} cy={y(pt.v)} r={4.5} fill={POINT} />
              <text x={x(pt.l) + 7} y={y(pt.v) - 6} fontSize={10} fill={POINT} className="font-mono">
                {pt.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="space-y-2 border-t px-4 py-3">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-40 shrink-0 font-mono text-muted-foreground">share of peak reached</span>
          <Range min={0.5} max={1} step={0.01} value={eff} accent={ACCENT} onChange={(e) => setEff(Number(e.target.value))} aria-label="share of peak bandwidth reached" className="w-full" />
          <span className="w-12 shrink-0 text-right font-mono tabular-nums">{(eff * 100).toFixed(0)}%</span>
        </label>
        <div className="grid gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
          <div>
            read per cycle <span className="text-foreground">{p.d} GB</span> at {p.bw} GB/s: at most{" "}
            <span className="text-foreground">{peak.toFixed(1)}</span> cycles a second
          </div>
          {p.lines.map((ln) => (
            <div key={ln.label}>
              {ln.label} needs L ≥ <span className="text-foreground">{(ln.v / perL).toFixed(1)}</span> tokens a cycle
            </div>
          ))}
          {p.points.map((pt) => (
            <div key={pt.label}>
              {pt.label} at L = {pt.l}: <span className="text-foreground">{((pt.v / (pt.l * peak)) * 100).toFixed(0)}%</span> of the 100% line
            </div>
          ))}
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          84% is what qwen-warp&apos;s no-draft cycle reaches: 13.55 GB in 17.3 ms. Points are the project&apos;s own measurements; dashed lines are claims
          from posts. A point above the solid line would need either fewer bytes or more of the bus.
        </p>
      </div>
    </figure>
  )
}

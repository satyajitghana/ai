"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Where a tokens-per-second number comes from, as a product of four factors:
//
//   tok/s (all users) = B · τ · η · BW / W
//
//   BW  the card's memory bandwidth (GB/s, from the spec sheet)
//   W   bytes read per pass over the weights (GB)
//   η   the share of BW a real decode step reaches
//   τ   tokens one pass commits per stream (1 without drafting, at most
//       max_draft + 1 = 9 in Kinetic's CUDA backend)
//   B   streams sharing the pass (Kinetic's Convoy, llama.cpp's -np)
//
// Every pass is assumed memory-bound: verifying 9 rows or serving 4 users
// is taken to cost what one row costs. That is optimistic, so a number
// above the bar needs a bigger τ or B than the sliders show, never less.
//
// Sources, all in the article: 336 / 360 / 936 GB/s are memory clock x bus
// width for the RTX 3060 Laptop, RTX 3060 12 GB and RTX 3090 (TechPowerUp); 1.10 GB is the size of
// LFM3-1.7B-Q4_K_M.gguf (its embedding is tied, so the output head reads it
// too); 2.8 GB is Kinetic's own figure for Qwen3.5 4B Q4_K_M; the reported
// points are Kinetic's README table.

type Gpu = { key: string; label: string; bw: number }
const GPUS: Gpu[] = [
  { key: "3060l", label: "RTX 3060 Laptop · 336 GB/s", bw: 336 },
  { key: "3060", label: "RTX 3060 12 GB · 360 GB/s", bw: 360 },
  { key: "3090", label: "RTX 3090 · 936 GB/s", bw: 936 },
]

type Model = { key: string; label: string; w: number; points: { v: number; label: string }[] }
const MODELS: Model[] = [
  {
    key: "lfm3",
    label: "LFM3 1.7B Q4_K_M · 1.10 GB",
    w: 1.1,
    points: [
      { v: 198.4, label: "generate 198.4" },
      { v: 1033.7, label: "edit 1033.7" },
    ],
  },
  {
    key: "q35",
    label: "Qwen3.5 4B Q4_K_M · 2.8 GB",
    w: 2.8,
    points: [
      { v: 89.9, label: "generate 89.9" },
      { v: 348.1, label: "edit 348.1" },
    ],
  },
]

type Preset = { key: string; label: string; eta: number; tau: number; b: number }
const PRESETS: Preset[] = [
  { key: "plain", label: "plain decode", eta: 0.65, tau: 1, b: 1 },
  { key: "edit", label: "the 1033.7 edit", eta: 0.65, tau: 5.2, b: 1 },
  { key: "ceiling", label: "full bandwidth, 9 per pass", eta: 1, tau: 9, b: 1 },
]

const fmt = (v: number, d = 0) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })

function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  shown: string
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-44 shrink-0 text-muted-foreground">{props.label}</span>
      <Range
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        aria-label={props.label}
        className="w-full"
      />
      <span className="w-16 shrink-0 text-right font-mono tabular-nums">{props.shown}</span>
    </label>
  )
}

const BAR = "oklch(0.55 0.16 250)"
const TAU = "oklch(0.62 0.17 45)"
const BCOL = "oklch(0.60 0.12 160)"
const PT_COL = "oklch(0.58 0.19 28)"

export function PassLedger() {
  const [gpuKey, setGpuKey] = useState("3060l")
  const [modelKey, setModelKey] = useState("lfm3")
  const [eta, setEta] = useState(0.65)
  const [tau, setTau] = useState(1)
  const [b, setB] = useState(1)
  const gpu = GPUS.find((g) => g.key === gpuKey) ?? GPUS[0]
  const model = MODELS.find((m) => m.key === modelKey) ?? MODELS[0]

  const passes = (eta * gpu.bw) / model.w
  const ceiling = gpu.bw / model.w
  const stream = passes * tau
  const total = stream * b

  const scaleMax = Math.max(total, ...model.points.map((p) => p.v), ceiling) * 1.1
  const W = 720
  const PL = 12
  const PW = W - 2 * PL
  const x = (v: number) => PL + (v / scaleMax) * PW

  const segs = [
    { label: "one pass, one token", v: passes, color: BAR },
    { label: "drafted tokens kept", v: stream - passes, color: TAU },
    { label: "other streams", v: total - stream, color: BCOL },
  ]
  let acc = 0

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        tok/s = streams × tokens per pass × efficiency × bandwidth ÷ bytes per pass
      </div>

      <div className="flex flex-col gap-2 border-b px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {GPUS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGpuKey(g.key)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                g.key === gpuKey ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MODELS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setModelKey(m.key)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                m.key === modelKey ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {m.label}
            </button>
          ))}
          <span className="mx-1 text-muted-foreground">·</span>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setEta(p.eta)
                setTau(p.tau)
                setB(p.b)
              }}
              className="rounded border px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 px-4 py-3">
        <Slider label="efficiency η (share of BW)" value={eta} min={0.3} max={1} step={0.01} shown={fmt(eta * 100) + "%"} onChange={setEta} />
        <Slider label="tokens kept per pass τ" value={tau} min={1} max={9} step={0.1} shown={fmt(tau, 1)} onChange={setTau} />
        <Slider label="streams sharing a pass B" value={b} min={1} max={4} step={1} shown={String(b)} onChange={setB} />
      </div>

      <div className="px-2 pb-2 sm:px-4">
        <svg
          viewBox={`0 0 ${W} 120`}
          className="w-full"
          role="img"
          aria-label={`${gpu.label}, ${model.label}: ${fmt(passes)} passes a second at ${fmt(eta * 100)}% of bandwidth, ${fmt(stream)} tokens a second for one stream with ${fmt(tau, 1)} tokens per pass, ${fmt(total)} for ${b} streams. The bandwidth ceiling for one token per pass is ${fmt(ceiling)}.`}
        >
          {segs.map((s) => {
            const x0 = x(acc)
            acc += s.v
            const w = x(acc) - x0
            return w > 0.5 ? <rect key={s.label} x={x0} y={34} width={w} height={26} fill={s.color} fillOpacity={0.85} /> : null
          })}
          <line x1={x(ceiling)} y1={24} x2={x(ceiling)} y2={70} stroke="var(--foreground)" strokeDasharray="3 3" />
          <text x={x(ceiling)} y={18} textAnchor="middle" fontSize={10} className="fill-foreground font-mono">
            ceiling at τ 1: {fmt(ceiling)}
          </text>
          {model.points.map((p, i) => (
            <g key={p.label}>
              <line x1={x(p.v)} y1={64} x2={x(p.v)} y2={88 + i * 14} stroke={PT_COL} />
              <circle cx={x(p.v)} cy={64} r={3.5} fill={PT_COL} />
              <text
                x={x(p.v)}
                y={98 + i * 14}
                textAnchor={x(p.v) > W - 90 ? "end" : "middle"}
                fontSize={10}
                fill={PT_COL}
                className="font-mono"
              >
                README {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t px-4 py-3 font-mono text-xs sm:grid-cols-4">
        <div>
          <div className="text-muted-foreground">passes / s</div>
          <div className="tabular-nums">{fmt(passes)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">one stream</div>
          <div className="tabular-nums">{fmt(stream)} tok/s</div>
        </div>
        <div>
          <div className="text-muted-foreground">all {b} streams</div>
          <div className="tabular-nums">{fmt(total)} tok/s</div>
        </div>
        <div>
          <div className="text-muted-foreground">τ the edit needs here</div>
          <div className="tabular-nums">{fmt(model.points[1].v / passes, 1)}</div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        A ceiling, not a prediction: every pass is costed as if it read the weights once and nothing else. The
        README&apos;s points are one stream each, so B stays 1 for them.
      </figcaption>
    </figure>
  )
}

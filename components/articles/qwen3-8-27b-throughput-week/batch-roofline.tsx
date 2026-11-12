"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10, mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// One decode step for B concurrent streams of Qwen3.8-27B.
//
// Every step reads the weights once, whatever B is. Each stream also reads
// and writes its own Gated DeltaNet state (48 layers x 48 heads x 128 x 128)
// and reads its own attention KV (16 layers x 2 x 4 heads x 256 per token).
// The math is B x rows x F, where rows is how many positions each stream
// verifies in the step (1 without speculation, k+1 with k drafts).
//
//   t_mem = (W + 2·S·B + κ·L·B) / (η · BW)
//   t_cmp = B · rows · F / P
//   t     = max(t_mem, t_cmp)
//   aggregate = B · τ / t        per stream = τ / t
//   B_max = floor(M / (S + κ·L))
//
//   W   weight bytes read per step            S  recurrent state per stream
//   κ   KV bytes per token                    L  tokens of context per stream
//   F   51.2 GFLOP per row (2 x 25.6B linear params, from config.json)
//   P   compute ceiling                       η  bandwidth efficiency
//   τ   tokens committed per stream per step  M  memory left for streams
//
// Sources, all named in the article:
//   3090: 936 GB/s and 16 GB of W4A16 weights (HyperQwen batch README); fp16
//         state; fp8 KV; 63 TFLOP/s sustained at 250 W (HyperQwen
//         docs/optimizations.md); η 0.79 fitted to its C1 of 46 tok/s;
//         M 6.2 GiB fitted so ~70 fp16-state and ~38 fp32-state streams fit
//         (its "~70 short requests" and "37 of 64" lines).
//   5090: 1,792 GB/s; 19.729 GiB NVFP4 weight arena (NInfer docs); fp32
//         state; K8V4 KV at 25.125 KiB/token; P 209.5 TFLOP/s is the dense
//         BF16 reference in Cinference's bench constants, a peak, not a
//         sustained figure; η 0.84 from the 71.2 tok/s MTP0 step; M 8.5 GiB
//         from fafstmobel's card (a 262,144-token K8V4 context starts with
//         993 MiB free beside 1.5 GB of desktop).
//   The lanes preset uses fafstmobel's 20.9 GiB (22.44 GB) resident weights.
//   The 8K preset is HyperQwen's raw-engine table (7,681-token prompts).

type Params = {
  bw: number
  w: number
  s: number
  kv: number
  p: number
  eta: number
  m: number
  b: number
  l: number
  tau: number
  rows: number
}

type Pt = { b: number; v: number; label: string }

type Preset = { key: string; label: string; params: Params; points: Pt[]; note: string }

const F = 51.2e9
const MIB = 1048576
const GIB = 1073741824

const PRESETS: Preset[] = [
  {
    key: "3090",
    label: "3090 · plain batching",
    params: { bw: 936, w: 16, s: 72, kv: 32, p: 63, eta: 0.79, m: 6.2, b: 64, l: 640, tau: 1, rows: 1 },
    points: [
      { b: 1, v: 45.6, label: "C1 45.6" },
      { b: 2, v: 83.7, label: "C2 83.7" },
      { b: 4, v: 162.7, label: "C4 162.7" },
      { b: 8, v: 321, label: "C8 321" },
      { b: 64, v: 1094, label: "C64 ~1,094" },
    ],
    note: "HyperQwen batch mode on one RTX 3090 at 250 W: decode throughput by cohort and the 64-concurrent steady state, from its batch README.",
  },
  {
    key: "raw8k",
    label: "3090 · 8K prompts",
    params: { bw: 936, w: 16, s: 72, kv: 32, p: 63, eta: 0.79, m: 6.2, b: 8, l: 8192, tau: 1, rows: 1 },
    points: [
      { b: 1, v: 46.9, label: "C1 46.9" },
      { b: 4, v: 94.8, label: "C4 94.8" },
      { b: 8, v: 111.5, label: "C8 111.5" },
    ],
    note: "HyperQwen's raw-engine cells: 7,681-token prompts, 511-token answers, speculation and prefix caching off, W4A16. The model overshoots these by far; the article discusses why.",
  },
  {
    key: "mtp3",
    label: "5090 · MTP3",
    params: { bw: 1792, w: 21.18, s: 144, kv: 25.125, p: 209.5, eta: 0.84, m: 8.5, b: 8, l: 4096, tau: 2.38, rows: 4 },
    points: [
      { b: 1, v: 143.8, label: "C1 143.8" },
      { b: 2, v: 267.6, label: "C2 267.6" },
      { b: 4, v: 461.1, label: "C4 461.1" },
      { b: 8, v: 766.6, label: "C8 766.6" },
    ],
    note: "NInfer's NVFP4 MTP3 decode-saturation run on one RTX 5090 (run NS), as retained in Cinference's docs. τ is 1 + 0.46 x 3.",
  },
  {
    key: "lanes",
    label: "5090 · 8 lanes, DFlash2",
    params: { bw: 1792, w: 22.44, s: 144, kv: 25.125, p: 209.5, eta: 0.84, m: 8.5, b: 8, l: 2048, tau: 5, rows: 16 },
    points: [
      { b: 8, v: 764, label: "TensorFold 764" },
      { b: 8, v: 1099, label: "Cinference avg 1,099" },
      { b: 8, v: 1623, label: "best second 1,623" },
    ],
    note: "The two eight-lane videos. Weights are fafstmobel's 20.9 GiB resident; TensorFold's checkpoint size is not published. Rows 16 is a 15-token DFlash2 block; τ 5 is fafstmobel's 4.016 accepted drafts per round plus the bonus token. Neither run published its acceptance, so a point above the line had a higher τ than the slider.",
  },
]

function model(p: Params, b: number) {
  const memBytes = p.w * 1e9 + b * 2 * p.s * MIB + b * p.l * p.kv * 1024
  const tMem = memBytes / (p.eta * p.bw * 1e9)
  const tCmp = (b * p.rows * F) / (p.p * 1e12)
  const t = Math.max(tMem, tCmp)
  return {
    tW: (p.w * 1e9) / (p.eta * p.bw * 1e9),
    tS: (b * 2 * p.s * MIB) / (p.eta * p.bw * 1e9),
    tK: (b * p.l * p.kv * 1024) / (p.eta * p.bw * 1e9),
    tMem,
    tCmp,
    t,
    agg: (b * p.tau) / t,
    per: p.tau / t,
  }
}

function bMax(p: Params) {
  const per = p.s * MIB + p.l * p.kv * 1024
  return Math.floor((p.m * GIB) / per)
}

const W = 760
const H = 330
const PL = 58
const PR = 24
const PT = 18
const PB = 44
const PW = W - PL - PR
const PH = H - PT - PB
const B_MAX = 128
const MEM = "oklch(0.55 0.16 250)"
const CMP = "oklch(0.62 0.17 45)"
const PER = "oklch(0.60 0.12 160)"
const PTC = "oklch(0.58 0.19 28)"

const fmt0 = (v: number) => Math.round(v).toLocaleString("en-US")

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
      <span className="w-40 shrink-0 text-muted-foreground">{props.label}</span>
      <Range
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        aria-label={props.label}
        className="w-full"
      />
      <span className="w-20 shrink-0 text-right font-mono tabular-nums">{props.shown}</span>
    </label>
  )
}

export function BatchRoofline() {
  const [key, setKey] = useState("3090")
  const [p, setP] = useState<Params>(PRESETS[0].params)
  const preset = PRESETS.find((x) => x.key === key) ?? PRESETS[0]
  const set = (k: keyof Params) => (v: number) => setP((o) => ({ ...o, [k]: v }))

  // log-scaled sliders: store the exponent, show the value
  const lExp = mlog10(p.l)
  const bExp = mlog10(p.b)

  const bs: number[] = []
  for (let i = 0; i <= 70; i++) bs.push(mpow(B_MAX, i / 70))
  const curve = bs.map((b) => ({ b, ...model(p, b) }))
  const now = model(p, p.b)
  const wall = bMax(p)

  const yTop = Math.max(...curve.map((c) => c.agg), ...preset.points.map((x) => x.v)) * 1.12
  const yMin = 5
  const lyMin = mlog10(yMin)
  const lyMax = mlog10(yTop)
  const px = (b: number) => PL + (mlog10(b) / mlog10(B_MAX)) * PW
  const py = (v: number) => PT + PH - ((mlog10(Math.max(v, yMin)) - lyMin) / (lyMax - lyMin)) * PH

  const yTicks = [10, 30, 100, 300, 1000, 3000].filter((v) => v <= yTop)
  const xTicks = [1, 2, 4, 8, 16, 32, 64, 128]

  // where compute starts to bind, if it does inside the range
  let bend: number | null = null
  for (const c of curve) {
    if (c.tCmp >= c.tMem) {
      bend = c.b
      break
    }
  }

  const fits = p.b <= wall
  const bound = now.tCmp >= now.tMem ? "compute" : "memory traffic"

  const segs = [
    { k: "w", label: "weights", ms: now.tW * 1e3, color: MEM },
    { k: "s", label: "recurrent state", ms: now.tS * 1e3, color: "oklch(0.68 0.12 250)" },
    { k: "kv", label: "KV cache", ms: now.tK * 1e3, color: "oklch(0.80 0.07 250)" },
  ]
  const barMax = Math.max(now.tMem, now.tCmp) * 1e3
  const barW = 520
  let acc = 0

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        One decode step, B streams of Qwen3.8-27B · a ceiling, not a prediction
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
        {PRESETS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              setKey(s.key)
              setP(s.params)
            }}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              s.key === key
                ? "border-foreground/40 bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="px-2 pt-3 sm:px-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Aggregate and per-stream decode ceilings against concurrent streams, log scales. At ${p.b} streams the ceiling is ${fmt0(now.agg)} tokens per second in total and ${fmt0(now.per)} per stream, bound by ${bound}. Memory for streams runs out at ${wall} streams.`}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PL} y1={py(v)} x2={PL + PW} y2={py(v)} stroke="var(--border)" strokeDasharray="2 4" />
              <text x={PL - 8} y={py(v) + 3.5} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
                {fmt0(v)}
              </text>
            </g>
          ))}
          {xTicks.map((b) => (
            <text key={b} x={px(b)} y={PT + PH + 16} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
              {b}
            </text>
          ))}
          <text x={PL + PW / 2} y={H - 6} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
            concurrent streams (B)
          </text>
          <text
            x={14}
            y={PT + PH / 2}
            textAnchor="middle"
            fontSize={10}
            transform={`rotate(-90 14 ${PT + PH / 2})`}
            className="fill-muted-foreground font-mono"
          >
            tok/s
          </text>

          {wall < B_MAX ? (
            <g>
              <rect
                x={px(Math.max(wall, 1))}
                y={PT}
                width={PL + PW - px(Math.max(wall, 1))}
                height={PH}
                fill={PTC}
                fillOpacity={0.07}
              />
              <line x1={px(Math.max(wall, 1))} y1={PT} x2={px(Math.max(wall, 1))} y2={PT + PH} stroke={PTC} strokeDasharray="5 4" />
              <text x={px(Math.max(wall, 1)) + 5} y={PT + 12} fontSize={10} fill={PTC} className="font-mono">
                memory full at {wall}
              </text>
            </g>
          ) : null}

          {bend !== null ? (
            <g>
              <line x1={px(bend)} y1={PT + 18} x2={px(bend)} y2={PT + PH} stroke={CMP} strokeOpacity={0.6} strokeDasharray="2 3" />
              <text x={px(bend) - 5} y={PT + PH - 6} textAnchor="end" fontSize={10} fill={CMP} className="font-mono">
                compute binds ≈ {Math.round(bend)}
              </text>
            </g>
          ) : null}

          <polyline
            points={curve.map((c) => `${px(c.b)},${py(c.agg)}`).join(" ")}
            fill="none"
            stroke={MEM}
            strokeWidth={2.2}
          />
          <polyline
            points={curve.map((c) => `${px(c.b)},${py(c.per)}`).join(" ")}
            fill="none"
            stroke={PER}
            strokeWidth={2}
            strokeDasharray="6 3"
          />
          <text x={PL + PW - 4} y={py(curve[curve.length - 1].agg) - 6} textAnchor="end" fontSize={10} fill={MEM} className="font-mono">
            aggregate
          </text>
          <text x={PL + PW - 4} y={py(curve[curve.length - 1].per) + 14} textAnchor="end" fontSize={10} fill={PER} className="font-mono">
            per stream
          </text>

          {preset.points.map((pt, i) => (
            <g key={pt.label}>
              <circle cx={px(pt.b)} cy={py(pt.v)} r={4.5} fill="var(--background)" stroke={PTC} strokeWidth={2} />
              <text
                x={px(pt.b) + (pt.b >= 32 ? -8 : 8)}
                y={py(pt.v) + (i % 2 === 0 ? -6 : 13)}
                textAnchor={pt.b >= 32 ? "end" : "start"}
                fontSize={9.5}
                className="fill-foreground font-mono"
              >
                {pt.label}
              </text>
            </g>
          ))}

          <line x1={px(p.b)} y1={PT} x2={px(p.b)} y2={PT + PH} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
          <circle cx={px(p.b)} cy={py(now.agg)} r={5} fill={MEM} stroke="var(--background)" strokeWidth={1.5} />
          <circle cx={px(p.b)} cy={py(now.per)} r={4} fill={PER} stroke="var(--background)" strokeWidth={1.5} />
        </svg>
      </div>

      <div className="border-t px-4 py-3">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 font-mono text-xs">
          <span className="text-muted-foreground">
            B = {p.b}: one step {(now.t * 1e3).toFixed(1)} ms, {bound} bound
          </span>
          <span>
            <span className="font-medium">{fmt0(now.agg)}</span> tok/s total ·{" "}
            <span className="font-medium">{now.per.toFixed(1)}</span> per stream
            {fits ? "" : " · does not fit"}
          </span>
        </div>
        <svg viewBox={`0 0 ${barW} 44`} className="w-full" role="img" aria-label="Memory time split into weights, state and KV, beside compute time">
          {segs.map((s) => {
            const x = acc
            const w = (s.ms / barMax) * barW
            acc += w
            return <rect key={s.k} x={x} y={2} width={Math.max(w - 1, 0.5)} height={16} rx={3} fill={s.color} />
          })}
          <rect x={0} y={24} width={Math.max(((now.tCmp * 1e3) / barMax) * barW - 1, 0.5)} height={16} rx={3} fill={CMP} />
        </svg>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          {segs.map((s) => (
            <span key={s.k}>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: s.color }} />
              {s.label} {s.ms.toFixed(1)} ms
            </span>
          ))}
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: CMP }} />
            math {(now.tCmp * 1e3).toFixed(1)} ms
          </span>
          <span>
            per stream {(p.s + (p.l * p.kv) / 1024).toFixed(0)} MiB · fits {wall}
          </span>
        </div>
      </div>

      <div className="grid gap-2 border-t px-4 py-3 sm:grid-cols-2 sm:gap-x-6">
        <Slider label="streams B" value={bExp} min={0} max={mlog10(B_MAX)} step={0.001} shown={String(p.b)} onChange={(v) => set("b")(Math.max(1, Math.round(mpow(10, v))))} />
        <Slider label="context per stream" value={lExp} min={2} max={mlog10(262144)} step={0.001} shown={fmt0(p.l)} onChange={(v) => set("l")(Math.round(mpow(10, v)))} />
        <Slider label="tokens / stream / step τ" value={p.tau} min={1} max={10} step={0.01} shown={p.tau.toFixed(2)} onChange={set("tau")} />
        <Slider label="rows verified / stream" value={p.rows} min={1} max={16} step={1} shown={String(p.rows)} onChange={set("rows")} />
        <Slider label="weights GB" value={p.w} min={8} max={30} step={0.01} shown={p.w.toFixed(2)} onChange={set("w")} />
        <Slider label="state MiB / stream" value={p.s} min={0} max={160} step={1} shown={String(p.s)} onChange={set("s")} />
        <Slider label="KV KiB / token" value={p.kv} min={8} max={64} step={0.125} shown={p.kv.toFixed(2)} onChange={set("kv")} />
        <Slider label="bandwidth GB/s" value={p.bw} min={300} max={2000} step={1} shown={String(p.bw)} onChange={set("bw")} />
        <Slider label="compute TFLOP/s" value={p.p} min={20} max={420} step={0.5} shown={p.p.toFixed(1)} onChange={set("p")} />
        <Slider label="bandwidth efficiency η" value={p.eta} min={0.5} max={1} step={0.01} shown={p.eta.toFixed(2)} onChange={set("eta")} />
        <Slider label="GiB free for streams" value={p.m} min={1} max={16} step={0.1} shown={p.m.toFixed(1)} onChange={set("m")} />
      </div>
      <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        {preset.note} The model leaves out drafting, attention arithmetic, sampling and launch
        gaps, so real engines land under the line; where they land over it, the inputs are wrong.
      </p>
    </figure>
  )
}

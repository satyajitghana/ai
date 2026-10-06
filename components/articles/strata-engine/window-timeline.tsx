"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One Strata verify window, as three lanes that start together after the
// GPU's per-layer front half and end at the slowest of them.
//
//   X      = E · U(T)                 distinct expert GB the window routes to
//   hit    = h · X                    read from the VRAM expert cache
//   pcie   = p · (1 − h) · X          misses copied over PCIe by the copy engine
//   cpu    = (1 − p)(1 − h) · X       misses computed in place by the CPU pool
//
//   t = D / (Bg·eff) + max( (hit + pcie) / (Bg·eff), pcie / Bp, cpu / Bc ) + fix
//   tok/s = L / t
//
// Constants from the code (commit 1735d64):
//   U(T) = 1, 1.75, 2.4, 3.05 for T = 1..4: include/strata/core/verify.hpp:11
//     ("1.75x one token's misses for T=2, 2.4x for 3, 3.05x for 4").
//   p defaults: 0.2 (Q2_0 pack) / 0.55 (native i-quant packs):
//     src/program/generate.cpp:550, scaled down below 20 GB/s at :1497.
//   T ≤ 4: setup.py:4775 writes --spec 4 --spec-min-p 0.5.
// Machine constants (paper Table 5, RTX 5070): hit rates 0.72 / 0.71, CPU
// 41 / 24 GB/s, drafting + other 6.3 / 7.0 ms, dense 3.54 GB per window.
// E: 480 experts per token × the arena per expert (0.66 / 0.84 / 0.98 GB).
// eff = 0.5 is the share of VRAM bandwidth the GPU half reaches, from the
// paper's own split (5.1 GB in 14.6 ms at 672 GB/s). The 3090 hit rate is not
// published anywhere: the preset's 0.70 is a solution, not a measurement.

type Params = {
  bg: number
  bp: number
  bc: number
  d: number
  e: number
  h: number
  p: number
  t: number
  l: number
  fix: number
}

type Preset = { key: string; label: string; p: Params; measured: number; mlabel: string }

const PRESETS: Preset[] = [
  {
    key: "q2",
    label: "RTX 5070 · Q2_0 · 4K",
    p: { bg: 672, bp: 26, bc: 41, d: 3.54, e: 0.66, h: 0.72, p: 0.2, t: 4, l: 3.23, fix: 6.3 },
    measured: 94.6,
    mlabel: "measured 94.6 (paper)",
  },
  {
    key: "iq3xxs",
    label: "RTX 5070 · IQ3_XXS · 4K",
    p: { bg: 672, bp: 26, bc: 24, d: 3.54, e: 0.84, h: 0.71, p: 0.55, t: 4, l: 3.24, fix: 7.0 },
    measured: 65.6,
    mlabel: "measured 65.6 (paper)",
  },
  {
    key: "3090",
    label: "RTX 3090 · IQ3_S · 2K prompt",
    p: { bg: 936, bp: 25, bc: 25, d: 3.54, e: 0.98, h: 0.7, p: 0.55, t: 4, l: 3.29, fix: 6.3 },
    measured: 97.0,
    mlabel: "reported 97.0 (video frame)",
  },
]

const UNION = [1, 1.75, 2.4, 3.05]
const EFF = 0.5

const C_DENSE = "oklch(0.55 0.16 250)"
const C_HIT = "oklch(0.66 0.13 200)"
const C_PCIE = "oklch(0.68 0.15 85)"
const C_CPU = "oklch(0.60 0.17 40)"
const C_FIX = "oklch(0.70 0.02 250)"

function model(p: Params) {
  const x = p.e * UNION[p.t - 1]
  const hit = p.h * x
  const miss = (1 - p.h) * x
  const pcie = p.p * miss
  const cpu = (1 - p.p) * miss
  const gb = p.bg * EFF
  const dense = (p.d / gb) * 1000
  const gpuE = ((hit + pcie) / gb) * 1000
  const dma = (pcie / p.bp) * 1000
  const cpuT = (cpu / p.bc) * 1000
  const lane = Math.max(gpuE, dma, cpuT)
  const total = dense + lane + p.fix
  const l = Math.min(p.l, p.t)
  const ram = ((pcie + cpu) / total) * 1000
  const bind = lane === cpuT ? "CPU" : lane === dma ? "PCIe" : "GPU"
  return { x, hit, pcie, cpu, dense, gpuE, dma, cpuT, lane, total, tps: (l / total) * 1000, ram, bind, l }
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
  accent,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  fmt: (v: number) => string
  onChange: (v: number) => void
  accent?: string
}) {
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-36 shrink-0 font-mono text-muted-foreground">{label}</span>
      <Range
        min={min}
        max={max}
        step={step}
        value={value}
        accent={accent}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full"
      />
      <span className="w-20 shrink-0 text-right font-mono tabular-nums">{fmt(value)}</span>
    </label>
  )
}

const W = 760
const LANE_H = 30
const PL = 92
const PR = 16
const PT = 24

export function WindowTimeline() {
  const [key, setKey] = useState("3090")
  const [p, setP] = useState<Params>(() => (PRESETS.find((s) => s.key === "3090") as Preset).p)
  const preset = PRESETS.find((s) => s.key === key)
  const set = (k: keyof Params) => (v: number) => setP((o) => ({ ...o, [k]: v }))
  const r = model(p)

  // a fixed time axis per preset, so moving a slider moves the bars, not the scale
  const base = preset ? model(preset.p).total : r.total
  const axis = Math.ceil((Math.max(base * 1.6, r.total * 1.05, 40)) / 10) * 10
  const pw = W - PL - PR
  const sx = (ms: number) => (ms / axis) * pw
  const x0 = PL
  const xl = x0 + sx(r.dense)
  const xe = xl + sx(r.lane)
  const rows = [
    { name: "GPU", segs: [
      { x: x0, w: sx(r.dense), c: C_DENSE, t: "dense + attention" },
      { x: xl, w: sx(r.gpuE), c: C_HIT, t: "cached + copied experts" },
    ] },
    { name: "PCIe", segs: [{ x: xl, w: sx(r.dma), c: C_PCIE, t: "DMA share of misses" }] },
    { name: "CPU", segs: [{ x: xl, w: sx(r.cpuT), c: C_CPU, t: "misses in place" }] },
    { name: "after", segs: [{ x: xe, w: sx(p.fix), c: C_FIX, t: "draft + commit" }] },
  ]
  const H = PT + rows.length * (LANE_H + 8) + 34
  const ticks: number[] = []
  for (let v = 0; v <= axis; v += axis > 60 ? 20 : 10) ticks.push(v)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        One verify window · three lanes after the doorbell · reasoned ceiling
      </div>
      <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
        {PRESETS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              setKey(s.key)
              setP(s.p)
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
          aria-label={`Timeline of one verify window: the GPU reads the dense weights for ${r.dense.toFixed(1)} ms, then three lanes run together: cached and copied experts on the GPU ${r.gpuE.toFixed(1)} ms, the PCIe copy ${r.dma.toFixed(1)} ms and the CPU's misses ${r.cpuT.toFixed(1)} ms. The ${r.bind} lane is the slowest. With ${p.fix.toFixed(1)} ms of drafting and commit the window takes ${r.total.toFixed(1)} ms, a ceiling of ${r.tps.toFixed(0)} tokens per second.`}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={x0 + sx(v)} y1={PT - 6} x2={x0 + sx(v)} y2={H - 26} stroke="var(--border)" strokeDasharray="2 4" />
              <text x={x0 + sx(v)} y={H - 12} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
                {v} ms
              </text>
            </g>
          ))}
          <line x1={xe} y1={PT - 10} x2={xe} y2={H - 26} stroke="var(--foreground)" strokeOpacity={0.5} strokeDasharray="4 3" />
          <text x={xe + 4} y={PT - 10} fontSize={10} className="fill-foreground font-mono">
            combine
          </text>
          {rows.map((row, i) => {
            const y = PT + i * (LANE_H + 8)
            return (
              <g key={row.name}>
                <text x={PL - 10} y={y + LANE_H / 2 + 4} textAnchor="end" fontSize={11} className="fill-muted-foreground font-mono">
                  {row.name}
                </text>
                {row.segs.map((s) =>
                  s.w > 0.2 ? (
                    <g key={s.t}>
                      <rect x={s.x} y={y} width={s.w} height={LANE_H} rx={3} fill={s.c} fillOpacity={0.85} />
                      {s.w > 92 ? (
                        <text x={s.x + 6} y={y + LANE_H / 2 + 4} fontSize={10} fill="white" className="font-mono">
                          {s.t}
                        </text>
                      ) : null}
                    </g>
                  ) : null
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="grid gap-2 border-t px-4 py-3 sm:grid-cols-2">
        <Slider label="VRAM hit rate h" value={p.h} min={0} max={1} step={0.01} fmt={(v) => v.toFixed(2)} onChange={set("h")} accent={C_HIT} />
        <Slider label="PCIe share p" value={p.p} min={0} max={1} step={0.05} fmt={(v) => v.toFixed(2)} onChange={set("p")} accent={C_PCIE} />
        <Slider label="CPU expert GB/s" value={p.bc} min={5} max={80} step={1} fmt={(v) => `${v} GB/s`} onChange={set("bc")} accent={C_CPU} />
        <Slider label="PCIe GB/s" value={p.bp} min={4} max={55} step={1} fmt={(v) => `${v} GB/s`} onChange={set("bp")} accent={C_PCIE} />
        <Slider label="window tokens T" value={p.t} min={1} max={4} step={1} fmt={(v) => `${v}`} onChange={(v) => setP((o) => ({ ...o, t: v, l: Math.min(o.l, v) }))} />
        <Slider label="committed L" value={p.l} min={1} max={4} step={0.01} fmt={(v) => v.toFixed(2)} onChange={(v) => setP((o) => ({ ...o, l: Math.min(v, o.t) }))} />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t px-4 py-3 font-mono text-xs sm:grid-cols-4">
        <div>
          <div className="text-muted-foreground">ceiling</div>
          <div className="text-base tabular-nums">{r.tps.toFixed(0)} tok/s</div>
        </div>
        <div>
          <div className="text-muted-foreground">{preset ? preset.mlabel.split(" (")[0] : "run"}</div>
          <div className="text-base tabular-nums">{preset ? `${preset.measured.toFixed(1)} tok/s` : "n/a"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">slowest lane</div>
          <div className="text-base">{r.bind}</div>
        </div>
        <div>
          <div className="text-muted-foreground">RAM read rate</div>
          <div className="text-base tabular-nums">{r.ram.toFixed(0)} GB/s</div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        {r.x.toFixed(2)} GB of distinct experts per window: {r.hit.toFixed(2)} from VRAM, {r.pcie.toFixed(2)} over PCIe,{" "}
        {r.cpu.toFixed(2)} on the CPU. A ceiling, not a prediction: on the 5070 the paper measured 82% of it for Q2_0 and
        67% for IQ3_XXS. The 3090 preset&apos;s hit rate is solved for, not published.
      </figcaption>
    </figure>
  )
}

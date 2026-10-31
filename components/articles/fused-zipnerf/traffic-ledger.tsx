"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { CORNER_TOTALS, COUNTS, GRIDS } from "./data"

// Bytes the featurize-and-MLP stage writes to global memory per interval, fused vs a plain tensor-by-tensor implementation.
//
// FUSED numbers are read from the kernels' output pointers (featurize_forward.cu, Renderer.render_rays_training):
//   proposal level, training   raw_density 4 B + fp32 features (12 or 16) x 4 B      -> 52 B / 68 B
//   proposal level, inference  raw_density 4 B only (features_float is null)         ->  4 B
//   NeRF level                 fp16 features, 56 padded columns = 112 B + 32 fp16 direction/bias columns = 64 B  -> 176 B
// UNFUSED numbers are an ASSUMPTION, not the official code: every intermediate a straightforward PyTorch version would
// materialise per interval (6 multisample positions and scales, corner indices, corner weights, gathered features, one feature
// vector per level, and for proposals the MLP's 64 pre-activations and 64 ReLU outputs). The official JAX code runs under XLA,
// which fuses some elementwise chains, so treat the unfused column as an upper bound for it. Table-row reads are not counted
// on either side: they are the same work in both.

const README_S = 35 * 60 + 47 // training time in the README, seconds
const ITERS = COUNTS.iterations

function fused(g: number, training: boolean): number {
  if (g === 2) return 176
  return training ? 4 + GRIDS[g].outFeatures * 4 : 4
}

function unfused(g: number, idxBytes: number): number {
  const grid = GRIDS[g]
  const perGrid = 6 * 3 * 4 + 6 * 4
  const perLevel = 6 * 8 * idxBytes + 6 * 8 * 4 + 6 * 8 * grid.features * 4 + (grid.features + 1) * 4
  const mlp = g === 2 ? 0 : 64 * 4 + 64 * 4 + 4
  return perGrid + grid.levels * perLevel + mlp
}

const NAMES = ["proposal 0", "proposal 1", "NeRF level"]
const C_F = "oklch(0.62 0.16 150)"
const C_U = "oklch(0.60 0.18 25)"

function Slider(props: { label: string; min: number; max: number; step: number; value: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-32 shrink-0 font-mono text-muted-foreground">{props.label}</span>
      <Range min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} aria-label={props.label} className="w-full" />
      <span className="w-28 shrink-0 text-right font-mono tabular-nums">{props.fmt(props.value)}</span>
    </label>
  )
}

export function TrafficLedger() {
  const [training, setTraining] = useState(true)
  const [idx, setIdx] = useState(8)
  const [rays, setRays] = useState(COUNTS.rays)
  const [bw, setBw] = useState(1800)
  const scale = rays / COUNTS.rays
  const rows = [0, 1, 2].map((g) => {
    const samples = COUNTS.samplesPerLevel[g] * scale
    return { g, samples, f: fused(g, training), u: unfused(g, idx) }
  })
  const lo = mlog10(4)
  const hi = mlog10(Math.max(...rows.map((r) => r.u)))
  const bar = (v: number) => ((mlog10(v) - lo) / (hi - lo)) * 100
  const gbF = rows.reduce((a, r) => a + (r.f * r.samples) / 1e9, 0)
  const gbU = rows.reduce((a, r) => a + (r.u * r.samples) / 1e9, 0)
  const msF = ((2 * gbF) / bw) * 1000
  const msU = ((2 * gbU) / bw) * 1000
  const readmeMs = (README_S / ITERS) * 1000
  const lookups = (CORNER_TOTALS.grid0 * COUNTS.samplesPerLevel[0] + CORNER_TOTALS.grid1 * COUNTS.samplesPerLevel[1] + CORNER_TOTALS.grid2 * COUNTS.samplesPerLevel[2]) / 1e9
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        bytes written per interval · fused: read from the kernels · unfused: an assumption, listed in the article · not profiled
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">pass</span>
        {[true, false].map((t) => (
          <button key={String(t)} type="button" onClick={() => setTraining(t)} aria-pressed={training === t} className={cn("rounded border px-2 py-0.5 font-mono text-[11px] transition-colors", training === t ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted")}>
            {t ? "training" : "inference"}
          </button>
        ))}
        <span className="ml-3 font-mono text-[11px] text-muted-foreground">unfused corner index</span>
        {[4, 8].map((b) => (
          <button key={b} type="button" onClick={() => setIdx(b)} aria-pressed={idx === b} className={cn("rounded border px-2 py-0.5 font-mono text-[11px] transition-colors", idx === b ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted")}>
            int{b * 8}
          </button>
        ))}
      </div>
      <div className="space-y-3 px-4 py-3">
        <ul className="space-y-2" aria-label="Bytes per interval, log scale">
          {rows.map((r) => (
            <li key={r.g} className="font-mono text-[11px]">
              <div className="mb-0.5 flex justify-between text-muted-foreground">
                <span>{NAMES[r.g]}</span>
                <span className="tabular-nums">
                  {r.u.toLocaleString("en-US")} B unfused → {r.f} B fused · {(r.u / r.f).toFixed(0)}× fewer
                </span>
              </div>
              <div className="relative h-2.5 rounded bg-muted" role="img" aria-label={`${NAMES[r.g]}: ${r.u} bytes unfused against ${r.f} bytes fused per interval`}>
                <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${bar(r.u)}%`, background: C_U, opacity: 0.55 }} />
                <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${bar(r.f)}%`, background: C_F }} />
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>4 B</span>
          <span>log scale</span>
          <span style={{ color: C_U }}>unfused</span>
          <span style={{ color: C_F }}>fused</span>
        </div>
        <Slider label="rays per iteration" min={8192} max={65536} step={8192} value={rays} fmt={(v) => v.toLocaleString("en-US")} onChange={setRays} />
        <Slider label="memory bandwidth" min={300} max={2000} step={50} value={bw} fmt={(v) => `${v} GB/s`} onChange={setBw} />
        <dl className="grid grid-cols-2 gap-2 font-mono text-[11px] md:grid-cols-4">
          {[
            ["written, unfused", `${gbU.toFixed(1)} GB`],
            ["written, fused", `${gbF.toFixed(2)} GB`],
            ["written + read back, unfused", `${msU.toFixed(0)} ms`],
            ["written + read back, fused", `${msF.toFixed(1)} ms`],
          ].map(([k, v]) => (
            <div key={k} className="rounded border px-2 py-1">
              <dt className="text-[9px] uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          The README&apos;s whole iteration (forward, backward, optimizer) is {readmeMs.toFixed(1)} ms: 35:47 for {ITERS.toLocaleString("en-US")} iterations. The table reads of
          the forward pass, which both sides share, are about {lookups.toFixed(2)} billion rows per iteration at {COUNTS.rays.toLocaleString("en-US")} rays
          (from the toy geometry). The bandwidth slider starts at 1,800 GB/s, the order of magnitude of a current high-end card&apos;s published peak; it is not measured here.
        </p>
      </div>
    </figure>
  )
}

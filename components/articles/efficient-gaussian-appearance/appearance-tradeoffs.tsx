"use client"

// Every number here is transcribed from arXiv 2609.05255v1:
// - Table 1 (five-run averages; train time, VRAM and FPS on an RTX 4090, MCMC, PPISP on real scenes)
//   for Mip-NeRF 360, Tanks & Temples / Deep Blending, NeRF Synthetic.
// - "outdoor" and "indoor" are my averages of the per-scene PSNR / SSIM in Table 9
//   (outdoor: bicycle flowers garden stump treehill; indoor: bonsai counter kitchen room).
//   The mean over all nine scenes reproduces Table 1's Mip-NeRF 360 PSNR to the second decimal.
// - "WebGL B/G" is Table 6: the viewer's per-Gaussian view-dependent payload, padded to 16-byte texels,
//   with SH quantized to Spark's 7/8/6-bit layout. The CUDA "B/G" is Table 1's fp32 footprint.
// No transcendental maths: bars are + - * / only.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

type Model = "None" | "SH" | "SV" | "NASG" | "NASGabor" | "Neural"
const MODELS: Model[] = ["None", "SH", "SV", "NASG", "NASGabor", "Neural"]

const BYTES: Record<Model, number> = { None: 12, SH: 192, SV: 208, NASG: 44, NASGabor: 48, Neural: 28 }
const WEBGL: Record<Model, number | null> = { None: null, SH: 40, SV: 112, NASG: 32, NASGabor: 32, Neural: 32 }

type DS = "m360" | "out" | "in" | "ttdb" | "syn"
const DATASETS: { id: DS; label: string }[] = [
  { id: "m360", label: "Mip-NeRF 360" },
  { id: "out", label: "  outdoor 5" },
  { id: "in", label: "  indoor 4" },
  { id: "ttdb", label: "T&T + Deep Blending" },
  { id: "syn", label: "NeRF Synthetic" },
]

// [psnr, ssim, train seconds, vram GiB, fps]; outdoor/indoor carry PSNR and SSIM only
const T: Record<DS, Record<Model, (number | null)[]>> = {
  m360: {
    None: [27.73, 0.825, 212, 4.6, 443.1],
    SH: [28.36, 0.836, 372, 6.7, 378.9],
    SV: [28.64, 0.834, 390, 6.8, 385.0],
    NASG: [28.5, 0.836, 234, 4.9, 439.9],
    NASGabor: [28.54, 0.836, 240, 5.0, 436.9],
    Neural: [28.55, 0.831, 257, 5.3, 443.6],
  },
  out: {
    None: [25.05, 0.745, null, null, null],
    SH: [25.49, 0.757, null, null, null],
    SV: [25.38, 0.752, null, null, null],
    NASG: [25.38, 0.758, null, null, null],
    NASGabor: [25.4, 0.758, null, null, null],
    Neural: [25.33, 0.748, null, null, null],
  },
  in: {
    None: [31.08, 0.925, null, null, null],
    SH: [31.95, 0.933, null, null, null],
    SV: [32.71, 0.936, null, null, null],
    NASG: [32.4, 0.934, null, null, null],
    NASGabor: [32.47, 0.935, null, null, null],
    Neural: [32.56, 0.935, null, null, null],
  },
  ttdb: {
    None: [27.65, 0.888, 137, 3.3, 763.3],
    SH: [27.96, 0.893, 250, 4.9, 683.2],
    SV: [27.98, 0.893, 260, 5.0, 696.6],
    NASG: [27.97, 0.893, 156, 3.6, 757.4],
    NASGabor: [27.96, 0.893, 159, 3.6, 743.6],
    Neural: [28.13, 0.893, 176, 3.9, 743.8],
  },
  syn: {
    None: [31.46, 0.959, 57, 1.3, 1734],
    SH: [34.01, 0.971, 82, 1.5, 1696],
    SV: [33.45, 0.968, 88, 1.6, 1576],
    NASG: [32.69, 0.966, 59, 1.3, 1826],
    NASGabor: [32.95, 0.967, 59, 1.3, 1852],
    Neural: [34.04, 0.97, 62, 1.3, 1869],
  },
}

type Metric = "psnr" | "ssim" | "train" | "vram" | "fps" | "bytes" | "webgl"
const METRICS: { id: Metric; label: string; idx: number; better: "hi" | "lo"; unit: string }[] = [
  { id: "psnr", label: "PSNR", idx: 0, better: "hi", unit: "dB" },
  { id: "ssim", label: "SSIM", idx: 1, better: "hi", unit: "" },
  { id: "train", label: "train time", idx: 2, better: "lo", unit: "" },
  { id: "vram", label: "peak VRAM", idx: 3, better: "lo", unit: "GiB" },
  { id: "fps", label: "FPS (4090)", idx: 4, better: "hi", unit: "" },
  { id: "bytes", label: "B/G CUDA", idx: -1, better: "lo", unit: "B" },
  { id: "webgl", label: "B/G WebGL", idx: -2, better: "lo", unit: "B" },
]

const fmtTime = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s` : `${s}s`)

const ACC = "oklch(0.6 0.14 200)"
const SH_C = "oklch(0.64 0.17 30)"
const MUTED = "oklch(0.62 0.03 255)"

export function AppearanceTradeoffs() {
  const [ds, setDs] = useState<DS>("m360")
  const [metric, setMetric] = useState<Metric>("psnr")
  const [millions, setMillions] = useState(6)

  const m = METRICS.find((x) => x.id === metric)!
  const perScene = ds === "out" || ds === "in"
  const value = (mo: Model): number | null => {
    if (m.idx === -1) return BYTES[mo]
    if (m.idx === -2) return WEBGL[mo]
    return T[ds][mo][m.idx]
  }
  const vals = MODELS.map(value)
  const present = vals.filter((v): v is number => v !== null)
  const vMax = present.length ? Math.max(...present) : 1
  const vMin = present.length ? Math.min(...present) : 0
  // PSNR and SSIM differences are small, so their bars start near the minimum
  const relative = m.id === "psnr" || m.id === "ssim"
  const lo = relative ? vMin - (vMax - vMin) * 0.6 - (m.id === "psnr" ? 0.1 : 0.002) : 0
  const best = m.better === "hi" ? vMax : vMin

  const fmt = (v: number) => {
    if (m.id === "train") return fmtTime(v)
    if (m.id === "ssim") return v.toFixed(3)
    if (m.id === "psnr") return v.toFixed(2)
    return String(v)
  }

  const W = 640
  const X0 = 96
  const BW = 440

  const appearanceMB = (mo: Model) => (BYTES[mo] * millions * 1e6) / 1e6

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>six appearance models, one pipeline</span>
        <span className="text-muted-foreground/60">paper Tables 1, 6, 9</span>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5 font-mono text-xs">
          {DATASETS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDs(d.id)}
              aria-pressed={ds === d.id}
              className={"whitespace-pre rounded border px-2.5 py-1 " + (ds === d.id ? "bg-foreground text-background" : "bg-background/50 text-muted-foreground")}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 font-mono text-xs">
          {METRICS.map((x) => {
            const disabled = perScene && x.idx >= 2
            return (
              <button
                key={x.id}
                type="button"
                disabled={disabled}
                onClick={() => setMetric(x.id)}
                aria-pressed={metric === x.id}
                className={
                  "rounded border px-2.5 py-1 disabled:opacity-30 " +
                  (metric === x.id ? "text-background" : "bg-background/50 text-muted-foreground")
                }
                style={metric === x.id ? { background: ACC, borderColor: ACC } : undefined}
              >
                {x.label}
              </button>
            )
          })}
        </div>

        <svg
          viewBox={`0 0 ${W} ${MODELS.length * 26 + 22}`}
          className="w-full"
          role="img"
          aria-label={`${m.label} for each appearance model on ${DATASETS.find((d) => d.id === ds)?.label.trim()}: ${MODELS.map((mo, i) => `${mo} ${vals[i] === null ? "n/a" : fmt(vals[i] as number)}`).join(", ")}.`}
        >
          <text x={X0} y={12} fontSize={10} className="fill-muted-foreground font-mono">
            {m.label}
            {m.unit ? ` (${m.unit})` : ""} · {m.better === "hi" ? "higher is better" : "lower is better"}
            {relative ? " · bars start near the lowest value" : ""}
          </text>
          {MODELS.map((mo, i) => {
            const v = vals[i]
            const y = 20 + i * 26
            const w = v === null ? 0 : ((v - lo) / (vMax - lo || 1)) * BW
            const isBest = v !== null && v === best
            const c = mo === "SH" ? SH_C : isBest ? ACC : MUTED
            return (
              <g key={mo}>
                <text x={10} y={y + 14} fontSize={11} className="fill-foreground font-mono">
                  {mo}
                </text>
                {v === null ? (
                  <text x={X0} y={y + 14} fontSize={10} className="fill-muted-foreground font-mono">
                    not applicable
                  </text>
                ) : (
                  <>
                    <rect x={X0} y={y + 3} width={Math.max(2, w)} height={16} rx={2} fill={c} fillOpacity={isBest || mo === "SH" ? 0.85 : 0.45} />
                    <text x={X0 + Math.max(2, w) + 6} y={y + 15} fontSize={10} className="fill-muted-foreground font-mono">
                      {fmt(v)}
                    </text>
                  </>
                )}
              </g>
            )
          })}
        </svg>

        <div className="rounded-lg border bg-background/50 px-3 py-2.5 font-mono text-xs leading-relaxed text-muted-foreground">
          <label className="block">
            deployed appearance at <span className="text-foreground">{millions} M</span> Gaussians (fp32 footprint from Table 1)
            <Range min={0.5} max={15} step={0.5} value={millions} onChange={(e) => setMillions(Number(e.target.value))} accent={ACC} className="mt-1 w-full" />
          </label>
          <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-0.5 sm:grid-cols-6">
            {MODELS.map((mo) => (
              <span key={mo}>
                {mo} <span className="text-foreground">{appearanceMB(mo).toFixed(0)} MB</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}

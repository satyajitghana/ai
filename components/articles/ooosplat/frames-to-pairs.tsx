"use client"

// From a phone clip to the number of image pairs COLMAP has to match.
//
// Frames (REASONED, re-implemented from src-tauri/src/video/frame_plan.rs at
// 82d4620): fps = min(source fps, max(preset target, 30 / duration)),
// frames = round(duration x fps), capped at the clip's frame count.
// Preset targets 6 / 8 / 12 fps (README table, config/pipeline-optimization.json).
//
// Pairs: exhaustive is n(n-1)/2. Sequential is what COLMAP 4.2.1 did with
// OOOSplat's flags (overlap 10, quadratic overlap at its default, loop
// detection off): on 30 frames it matched 119 pairs (MEASURED), which is
// exactly the pairs at index offsets 1, 2, 4, 8, 16, i.e. sum over j < 10 of
// max(0, n - 2^j). The curve uses that fitted rule; loop detection, which
// OOOSplat turns on for some presets, would add pairs on top.
//
// SSR-safe: integer arithmetic only.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

const PRESETS = [
  { id: "Fast", fps: 6 },
  { id: "Balanced", fps: 8 },
  { id: "Detailed", fps: 12 },
]
const SEQ = "oklch(0.62 0.15 200)"
const EXH = "oklch(0.66 0.17 30)"

function framesFor(duration: number, sourceFps: number, target: number) {
  const fps = Math.min(sourceFps, Math.max(target, 30 / duration))
  return Math.min(Math.round(duration * sourceFps), Math.max(1, Math.round(duration * fps)))
}
function seqPairs(n: number) {
  let s = 0
  let off = 1
  for (let j = 0; j < 10; j++) {
    s += Math.max(0, n - off)
    off *= 2
  }
  return s
}
function exhPairs(n: number) {
  return (n * (n - 1)) / 2
}
const fmt = (v: number) => Math.round(v).toLocaleString("en-US")

export function FramesToPairs() {
  const [duration, setDuration] = useState(40)
  const [preset, setPreset] = useState(1)
  const [srcFps, setSrcFps] = useState(30)

  const n = framesFor(duration, srcFps, PRESETS[preset].fps)
  const seq = seqPairs(n)
  const exh = exhPairs(n)

  // chart: pairs vs frames, 0..N_MAX on a sqrt y-axis so both curves fit
  const N_MAX = 4000
  const W = 640
  const H = 200
  const L = 56
  const R = 16
  const T = 12
  const B = 30
  const yMax = exhPairs(N_MAX)
  const xs = (k: number) => L + (k / N_MAX) * (W - L - R)
  const ys = (p: number) => T + (1 - Math.sqrt(p / yMax)) * (H - T - B)
  const pts = (f: (k: number) => number) =>
    Array.from({ length: 81 }, (_, i) => {
      const k = (i * N_MAX) / 80
      return `${xs(k).toFixed(1)},${ys(f(k)).toFixed(1)}`
    }).join(" ")
  const ticks = [1000, 10000, 100000, 1000000, 4000000]
  const nc = Math.min(n, N_MAX)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>a clip, its frames, and the pairs COLMAP matches</span>
        <span className="text-muted-foreground/60">re-implemented · measured at 30 frames</span>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block font-mono text-xs text-muted-foreground">
            clip length: <span className="text-foreground">{duration} s</span>
            <Range min={3} max={600} step={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} accent={SEQ} className="mt-1 w-full" />
          </label>
          <div className="font-mono text-xs text-muted-foreground">
            preset
            <div className="mt-1 flex gap-1.5">
              {PRESETS.map((p, i) => (
                <button key={p.id} type="button" onClick={() => setPreset(i)} aria-pressed={preset === i}
                  className={"rounded border px-2 py-0.5 " + (preset === i ? "text-background" : "bg-background/50")}
                  style={preset === i ? { background: SEQ, borderColor: SEQ } : undefined}>
                  {p.id}
                </button>
              ))}
            </div>
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            source
            <div className="mt-1 flex gap-1.5">
              {[24, 30, 60].map((f) => (
                <button key={f} type="button" onClick={() => setSrcFps(f)} aria-pressed={srcFps === f}
                  className={"rounded border px-2 py-0.5 " + (srcFps === f ? "text-background" : "bg-background/50")}
                  style={srcFps === f ? { background: SEQ, borderColor: SEQ } : undefined}>
                  {f} fps
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-2 font-mono text-xs sm:grid-cols-3">
          <div className="rounded-lg border bg-background/50 px-3 py-2">
            <div className="text-muted-foreground">frames kept</div>
            <div className="text-lg text-foreground">{fmt(n)}</div>
            <div className="text-muted-foreground">{(n / duration).toFixed(2)} per second</div>
          </div>
          <div className="rounded-lg border bg-background/50 px-3 py-2">
            <div className="text-muted-foreground">sequential pairs</div>
            <div className="text-lg" style={{ color: SEQ }}>{fmt(seq)}</div>
            <div className="text-muted-foreground">video path, overlap 10</div>
          </div>
          <div className="rounded-lg border bg-background/50 px-3 py-2">
            <div className="text-muted-foreground">exhaustive pairs</div>
            <div className="text-lg" style={{ color: EXH }}>{fmt(exh)}</div>
            <div className="text-muted-foreground">{exh > 0 ? `${(exh / Math.max(seq, 1)).toFixed(1)}x the sequential` : "-"}</div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Pairs to match against frames, up to 4,000 frames. At ${n} frames, sequential matching needs ${fmt(seq)} pairs and exhaustive matching ${fmt(exh)}.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={ys(t)} y2={ys(t)} stroke="currentColor" strokeOpacity={0.08} />
              <text x={L - 6} y={ys(t) + 3} fontSize={9} textAnchor="end" className="fill-muted-foreground font-mono">{t >= 1e6 ? `${t / 1e6}M` : `${t / 1e3}k`}</text>
            </g>
          ))}
          {[0, 1000, 2000, 3000, 4000].map((k) => (
            <text key={k} x={xs(k)} y={H - 12} fontSize={9} textAnchor="middle" className="fill-muted-foreground font-mono">{k}</text>
          ))}
          <text x={W - R} y={H - 1} fontSize={9} textAnchor="end" className="fill-muted-foreground font-mono">frames (pairs on a square-root axis)</text>
          <polyline points={pts(exhPairs)} fill="none" stroke={EXH} strokeWidth={2} />
          <polyline points={pts(seqPairs)} fill="none" stroke={SEQ} strokeWidth={2} />
          <line x1={xs(nc)} x2={xs(nc)} y1={T} y2={H - B} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="3 3" />
          <circle cx={xs(nc)} cy={ys(exhPairs(nc))} r={4} fill={EXH} />
          <circle cx={xs(nc)} cy={ys(seqPairs(nc))} r={4} fill={SEQ} />
        </svg>

        <p className="font-mono text-xs leading-relaxed text-muted-foreground">
          Measured on 30 rendered frames, pycolmap 4.2.1, 2 CPU threads: sequential matched{" "}
          <span style={{ color: SEQ }}>119 pairs in 4.07 s</span>, exhaustive{" "}
          <span style={{ color: EXH }}>435 pairs in 16.74 s</span>. Exhaustive is what OOOSplat uses for an
          image folder of up to 100 photos; above 100 it asks whether the filenames are in capture order.
        </p>
      </div>
    </figure>
  )
}

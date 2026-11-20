"use client"

import { useEffect, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { RUNS } from "./toy-runs"

// A replay of my reimplementation of TFD-SfM's toy: the paper's 2x2 (absolute
// or chained poses, shared points or per-observation Gaussians), every run from
// identity cameras and unit depth. Seen from above: grey is the true orbit,
// colour the estimate (placed with the root camera's true pose and the best
// scale). The runs were recorded offline from the same code; the slider scrubs
// through the saved snapshots.

const VARIANTS: { id: string; label: string }[] = [
  { id: "abs-shared", label: "absolute poses · shared points" },
  { id: "abs-gauss", label: "absolute poses · Gaussians" },
  { id: "chain-shared", label: "chained poses · shared points" },
  { id: "chain-gauss", label: "chained poses · Gaussians" },
]

const S = 200
const K = 0.2 // px per hundredth of a unit: the orbit (radius 400) is 80 px
const px = (v: number) => S / 2 + v * K
const py = (v: number) => S / 2 - v * K
const clamp = (v: number) => Math.max(-480, Math.min(480, v))

const OK = "oklch(0.58 0.15 155)"
const BAD = "oklch(0.62 0.19 30)"

export function TrackFreeReplay() {
  const [spanIdx, setSpanIdx] = useState(0)
  const [frame, setFrame] = useState(1000)
  const [playing, setPlaying] = useState(false)
  const span = RUNS[spanIdx]
  const nFrames = span.runs["chain-gauss"].length
  const f = Math.min(frame, nFrames - 1)

  const atEnd = f >= nFrames - 1
  const running = playing && !atEnd

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setFrame((x) => Math.min(x + 1, nFrames - 1)), 280)
    return () => window.clearInterval(id)
  }, [running, nFrames])

  const it = span.runs["chain-gauss"][f].it

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>cold-start toy, four objectives, seen from above</span>
        <span className="text-muted-foreground/60">recorded runs of my reimplementation, replayed</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        {RUNS.map((r, i) => (
          <button
            key={r.n}
            type="button"
            onClick={() => {
              setSpanIdx(i)
              setFrame(0)
              setPlaying(true)
            }}
            aria-pressed={spanIdx === i}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
              spanIdx === i ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {r.n} cameras, {r.arc}° arc
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            if (atEnd) {
              setFrame(0)
              setPlaying(true)
            } else setPlaying(!running)
          }}
          className="rounded-full border px-3 py-1 font-mono text-[11px] text-foreground hover:bg-muted"
        >
          {running ? "pause" : "play"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 px-3 pt-3 md:grid-cols-4">
        {VARIANTS.map((v) => {
          const snap = span.runs[v.id][Math.min(f, span.runs[v.id].length - 1)]
          const good = snap.err < 5
          const col = good ? OK : BAD
          const cams = []
          for (let i = 0; i < span.n; i++) cams.push(snap.cams.slice(i * 4, i * 4 + 4))
          const gts = []
          for (let i = 0; i < span.n; i++) gts.push(span.gt.slice(i * 4, i * 4 + 4))
          const pts = []
          for (let i = 0; i + 1 < snap.pts.length; i += 2) pts.push([snap.pts[i], snap.pts[i + 1]])
          return (
            <div key={v.id} className="rounded-lg border bg-background/60">
              <svg
                viewBox={`0 0 ${S} ${S}`}
                className="h-auto w-full"
                role="img"
                aria-label={`${v.label}, ${span.n} cameras over ${span.arc} degrees, iteration ${snap.it}: mean relative-rotation error ${snap.err} degrees.`}
              >
                <circle cx={S / 2} cy={S / 2} r={400 * K} fill="none" className="stroke-muted-foreground" strokeDasharray="2 3" strokeWidth={0.6} opacity={0.6} />
                {pts.map((p, k) => (
                  <circle key={`p${k}`} cx={px(clamp(p[0]))} cy={py(clamp(p[1]))} r={1.4} fill={col} opacity={0.45} />
                ))}
                {gts.map((g, i) => (
                  <g key={`g${i}`}>
                    <line x1={px(g[0])} y1={py(g[1])} x2={px(g[0]) + g[2] * 0.1} y2={py(g[1]) - g[3] * 0.1} className="stroke-muted-foreground" strokeWidth={1} />
                    <circle cx={px(g[0])} cy={py(g[1])} r={2.4} className="fill-muted-foreground" />
                  </g>
                ))}
                {cams.map((c, i) => (
                  <g key={`c${i}`}>
                    <line x1={px(clamp(c[0]))} y1={py(clamp(c[1]))} x2={px(clamp(c[0])) + c[2] * 0.12} y2={py(clamp(c[1])) - c[3] * 0.12} stroke={col} strokeWidth={1.6} />
                    <circle cx={px(clamp(c[0]))} cy={py(clamp(c[1]))} r={2.8} className="fill-background" stroke={col} strokeWidth={1.3} />
                  </g>
                ))}
              </svg>
              <div className="border-t px-2 py-1.5 font-mono text-[10px] leading-snug text-muted-foreground">
                <div>{v.label}</div>
                <div>
                  rotation error <span style={{ color: col }}>{snap.err.toFixed(1)}°</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="px-4 pb-2 pt-3">
        <label className="block font-mono text-[11px] text-muted-foreground">
          iteration {it.toLocaleString("en-US")} of 15,000
          <Range
            min={0}
            max={nFrames - 1}
            step={1}
            value={f}
            onChange={(e) => {
              setPlaying(false)
              setFrame(Number(e.target.value))
            }}
          />
        </label>
      </div>
      <figcaption className="border-t px-4 py-3 font-mono text-[11px] text-muted-foreground">
        Grey: the true cameras on their orbit. Colour: the estimate, green once the mean pairwise rotation error is under 5°. Every run starts with all cameras at
        the identity, so at iteration 0 they sit on top of the root camera. Seed 1, 1 px of noise.
      </figcaption>
    </figure>
  )
}

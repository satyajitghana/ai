"use client"

import { useMemo, useState } from "react"

import { BODY_LEN, DEER_PX, DEER_SPEED, FPS, FRAMES, SRC_H, SRC_W, TREES, VIEW_H, VIEW_W } from "./smear-data"

// The time smear, built one kept frame at a time, from my own run (see smear-data.ts).
// Every dot is a real back-projected deer pixel from the synthetic clip, seen from the god's-eye camera.
// Counts are measured: a kept frame adds as many Gaussians as its mask has pixels.
// Bytes per Gaussian come from the 3DGS .ply layout: 62 float32 at SH degree 3, 14 at degree 0.

const BYTES_SH3 = 62 * 4
const BYTES_SH0 = 14 * 4
const STRIDES = [3, 6, 15, 30] as const
const SCALE_1080 = (1920 * 1080) / (SRC_W * SRC_H) // 36: same framing, more pixels

type Pt = { x: number; y: number; g: number }

const DECODED: Pt[][] = FRAMES.map((s) => {
  const out: Pt[] = []
  for (let i = 0; i + 7 <= s.length; i += 7) {
    out.push({ x: Number(s.slice(i, i + 3)), y: Number(s.slice(i + 3, i + 6)), g: Number(s[i + 6]) })
  }
  return out
})

const fmtInt = (n: number) => n.toLocaleString("en-US")
const fmtMB = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`)

export function SmearBuilder() {
  const lastFrame = DEER_PX.length - 1 // 149
  const [upto, setUpto] = useState(lastFrame)
  const [stride, setStride] = useState<(typeof STRIDES)[number]>(6)

  const kept = useMemo(() => {
    const ks: number[] = []
    for (let f = 0; f <= upto; f += stride) ks.push(f)
    return ks
  }, [upto, stride])

  const gaussians = kept.reduce((a, f) => a + DEER_PX[f], 0)
  const spacing = (stride * DEER_SPEED) / FPS
  const overlap = spacing < BODY_LEN
  const latest = kept[kept.length - 1]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the smear, built from my run · every dot is a real back-projected deer pixel, seen from the god&apos;s-eye camera
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[1.5fr_1fr]">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full rounded-sm"
          role="img"
          aria-label={`Oblique view from high above a meadow with seven trees. ${kept.length} copies of the deer are left in place along its path, one for every ${stride}th frame up to frame ${upto + 1} of ${lastFrame + 1}.`}
        >
          <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="oklch(0.86 0.06 135)" />
          {TREES.map(([bx, by, cx, cy, r], i) => (
            <g key={i}>
              <line x1={bx} y1={by} x2={cx} y2={cy + r * 0.6} stroke="oklch(0.38 0.05 60)" strokeWidth={4} strokeLinecap="round" />
              <circle cx={cx} cy={cy} r={r} fill="oklch(0.48 0.1 145)" fillOpacity={0.85} />
            </g>
          ))}
          {kept.map((f) => {
            const k = f / 3
            const pts = DECODED[k]
            const isLatest = f === latest
            return (
              <g key={f} opacity={isLatest ? 1 : 0.8}>
                {pts.map((p, j) => (
                  <circle
                    key={j}
                    cx={p.x}
                    cy={p.y}
                    r={isLatest ? 2.1 : 1.7}
                    fill={`oklch(${(0.3 + p.g * 0.06).toFixed(2)} 0.09 ${isLatest ? 35 : 60})`}
                  />
                ))}
              </g>
            )
          })}
          <text x={8} y={VIEW_H - 8} fontSize={10} className="fill-foreground font-mono">
            the handheld camera walks along below the bottom edge
          </text>
        </svg>

        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-xs text-muted-foreground">frames seen so far</span>
            <input
              type="range"
              min={0}
              max={lastFrame}
              step={3}
              value={upto}
              onChange={(e) => setUpto(Number(e.target.value))}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground"
              aria-label="frames seen so far"
            />
            <span className="font-mono tabular-nums">
              {upto + 1} of {lastFrame + 1} ({((upto + 1) / FPS).toFixed(1)} s)
            </span>
          </label>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs text-muted-foreground">keep every n-th frame</span>
            <div className="flex flex-wrap gap-1" role="group" aria-label="keep every n-th frame">
              {STRIDES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStride(s)}
                  aria-pressed={stride === s}
                  className={`rounded border px-2 py-0.5 font-mono text-xs ${stride === s ? "bg-foreground text-background" : "hover:bg-muted"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs tabular-nums">
            <dt className="text-muted-foreground">copies</dt>
            <dd>{kept.length}</dd>
            <dt className="text-muted-foreground">Gaussians</dt>
            <dd>{fmtInt(gaussians)} <span className="text-muted-foreground">measured</span></dd>
            <dt className="text-muted-foreground">SH 3 / SH 0</dt>
            <dd>
              {fmtMB(gaussians * BYTES_SH3)} / {fmtMB(gaussians * BYTES_SH0)}
            </dd>
            <dt className="text-muted-foreground">same at 1080p</dt>
            <dd>
              {fmtInt(gaussians * SCALE_1080)} · {fmtMB(gaussians * SCALE_1080 * BYTES_SH3)} <span className="text-muted-foreground">reasoned</span>
            </dd>
            <dt className="text-muted-foreground">copy spacing</dt>
            <dd>
              {spacing.toFixed(2)} m · {overlap ? "copies overlap: one continuous form" : "gaps: separate copies"}
            </dd>
          </dl>
          <p className="text-xs text-muted-foreground">
            The newest copy is drawn darker and larger. Spacing is speed times stride over frame rate; the body is {BODY_LEN} m long, so
            the copies fuse while the spacing stays under it.
          </p>
        </div>
      </div>
    </figure>
  )
}

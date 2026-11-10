"use client"

// debim's "visual fidelity" score, rebuilt in 2D so the mechanism is visible.
// The real metric (tools/render_visual_regression.py) renders the original IFC
// element and the debim element separately, each centred on its own bounding box
// and scaled so its largest side spans 1.6 of a 2-unit frame, on a dark ground,
// 300 x 300 px; a pixel "differs" when its mean RGB difference passes 25; the
// score is 1 minus the share of differing pixels, and an element "passes" at
// 0.85. This toy does the same on a 64 x 64 grid with flat silhouettes instead
// of shaded 3D renders, so its numbers are ILLUSTRATIVE. The table under it is
// MEASURED: my re-implementation of the real renderer and comparison, run on
// 50 elements of four public IFC samples. SSR-safe: plain state; no
// transcendental maths (rotation is a 90-degree swap).

import { useMemo, useState } from "react"

const N = 64

type Rect = [number, number, number, number] // x0, y0, x1, y1 in metres

type Shape = { id: string; label: string; rects: Rect[] }

// End view of a steel I-section, a door leaf in its frame, an L-shaped wall in plan.
// Proportions simplified so the thin parts survive a 64-cell grid.
const SHAPES: Shape[] = [
  {
    id: "ibeam",
    label: "I-section (end view)",
    rects: [
      [0, 0, 0.2, 0.025],
      [0, 0.275, 0.2, 0.3],
      [0.09, 0.025, 0.11, 0.275],
    ],
  },
  {
    id: "door",
    label: "door frame (elevation)",
    rects: [
      [0, 0, 0.06, 2.1],
      [0.84, 0, 0.9, 2.1],
      [0, 2.04, 0.9, 2.1],
      [0.1, 0, 0.8, 2.0],
    ],
  },
  {
    id: "lwall",
    label: "L-shaped wall (plan)",
    rects: [
      [0, 0, 4, 0.2],
      [0, 0.2, 0.2, 3],
    ],
  },
]

type Cand = { id: string; label: string }
const CANDS: Cand[] = [
  { id: "exact", label: "exact copy" },
  { id: "bbox", label: "its bounding box" },
  { id: "rot", label: "box turned 90°" },
  { id: "moved", label: "3x bigger, 40 m away" },
  { id: "empty", label: "nothing at all" },
]

function bounds(rs: Rect[]): Rect {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const r of rs) {
    x0 = Math.min(x0, r[0])
    y0 = Math.min(y0, r[1])
    x1 = Math.max(x1, r[2])
    y1 = Math.max(y1, r[3])
  }
  return [x0, y0, x1, y1]
}

function candidate(s: Shape, id: string): Rect[] {
  const b = bounds(s.rects)
  const cx = (b[0] + b[2]) / 2
  const cy = (b[1] + b[3]) / 2
  if (id === "exact") return s.rects
  if (id === "bbox") return [b]
  if (id === "rot") {
    const hw = (b[3] - b[1]) / 2
    const hh = (b[2] - b[0]) / 2
    return [[cx - hw, cy - hh, cx + hw, cy + hh]]
  }
  if (id === "moved") return s.rects.map((r) => [r[0] * 3 + 40, r[1] * 3, r[2] * 3 + 40, r[3] * 3] as Rect)
  return []
}

// A frame maps world -> cells. Normalised: each shape centred on its own box,
// largest side = 0.8 of the frame. Fixed: the original's frame for both.
type Frame = { cx: number; cy: number; s: number }
function frameOf(rs: Rect[]): Frame {
  if (rs.length === 0) return { cx: 0, cy: 0, s: 1 }
  const b = bounds(rs)
  const span = Math.max(b[2] - b[0], b[3] - b[1], 1e-3)
  return { cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, s: span / 0.8 }
}

function raster(rs: Rect[], f: Frame): Uint8Array {
  const g = new Uint8Array(N * N)
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = f.cx + ((i + 0.5) / N - 0.5) * f.s
      const y = f.cy + (0.5 - (j + 0.5) / N) * f.s
      for (const r of rs)
        if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) {
          g[j * N + i] = 1
          break
        }
    }
  return g
}

const MEASURED = [
  { what: "the element against its own bounding box", median: "96.8%", pass: "48 / 50" },
  { what: "the element, 3x bigger and 40 m away", median: "100.0%", pass: "50 / 50" },
  { what: "its bounding box, axes swapped", median: "92.6%", pass: "48 / 50" },
  { what: "an empty frame", median: "92.2%", pass: "42 / 50" },
  { what: "a unit cube", median: "68.0%", pass: "4 / 50" },
]

export function PixelScore() {
  const [si, setSi] = useState(0)
  const [ci, setCi] = useState(1)
  const [norm, setNorm] = useState(true)
  const shape = SHAPES[si]
  const cand = CANDS[ci]

  const r = useMemo(() => {
    const cr = candidate(shape, cand.id)
    const fo = frameOf(shape.rects)
    const fc = norm ? frameOf(cr) : fo
    const a = raster(shape.rects, fo)
    const b = raster(cr, fc)
    let diff = 0
    let lit = 0
    for (let k = 0; k < N * N; k++) {
      if (a[k] !== b[k]) diff++
      if (a[k]) lit++
    }
    return { a, b, score: 1 - diff / (N * N), lit: lit / (N * N) }
  }, [shape, cand, norm])

  const cell = 4
  const pass = r.score >= 0.85
  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent"
      aria-label="A two-dimensional rebuild of debim's pixel-difference visual fidelity score"
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>visual fidelity, rebuilt</span>
        <span className="text-muted-foreground/60">toy above · measured below</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_15rem] sm:p-5">
        <div>
          <svg
            viewBox={`0 0 ${N * cell} ${N * cell}`}
            className="w-full max-w-[22rem] rounded-md border"
            role="img"
            aria-label={`${shape.label} compared with ${cand.label}: score ${(r.score * 100).toFixed(1)} percent`}
          >
            <rect width={N * cell} height={N * cell} fill="#0f172a" />
            {Array.from({ length: N * N }, (_, k) => {
              const a = r.a[k]
              const b = r.b[k]
              if (!a && !b) return null
              const fill = a && b ? "#38bdf8" : "#ef4444"
              return <rect key={k} x={(k % N) * cell} y={Math.floor(k / N) * cell} width={cell} height={cell} fill={fill} />
            })}
          </svg>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            blue: both lit · red: differs · dark: both empty, which counts as a match
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">original element</span>
            <select
              className="mt-1 w-full rounded-md border bg-background px-2 py-1 font-mono text-xs"
              value={si}
              onChange={(e) => setSi(Number(e.target.value))}
            >
              {SHAPES.map((s, i) => (
                <option key={s.id} value={i}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">what the copy is</span>
            <select
              className="mt-1 w-full rounded-md border bg-background px-2 py-1 font-mono text-xs"
              value={ci}
              onChange={(e) => setCi(Number(e.target.value))}
            >
              {CANDS.map((c, i) => (
                <option key={c.id} value={i}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <input type="checkbox" checked={norm} onChange={(e) => setNorm(e.target.checked)} />
            centre and scale each on its own box (debim does)
          </label>
          <div className="rounded-md border p-3 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">lit by original</span>
              <span>{(r.lit * 100).toFixed(1)}%</span>
            </div>
            <div className="mt-1 flex justify-between text-base">
              <span>score</span>
              <span className={pass ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                {(r.score * 100).toFixed(1)}%
              </span>
            </div>
            <div className="mt-1 text-muted-foreground">{pass ? "PASS (≥ 85%)" : "below the 85% pass line"}</div>
          </div>
        </div>
      </div>
      <div className="border-t px-4 py-3 sm:px-5">
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left font-normal">real render, original vs …</th>
              <th className="text-right font-normal">median</th>
              <th className="text-right font-normal">pass</th>
            </tr>
          </thead>
          <tbody>
            {MEASURED.map((m) => (
              <tr key={m.what}>
                <td className="py-0.5 pr-2">{m.what}</td>
                <td className="text-right">{m.median}</td>
                <td className="text-right">{m.pass}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs leading-snug text-muted-foreground">
          Measured: 50 elements, one per type, from the Duplex and the three buildingSMART samples, rendered with matplotlib the way
          the repo&apos;s script does. The median element lights 7.8% of the frame, so a blank frame already agrees on the other
          92%.
        </p>
      </div>
    </figure>
  )
}

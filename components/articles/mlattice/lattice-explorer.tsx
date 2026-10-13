"use client"

import { useMemo, useState, type PointerEvent } from "react"

import { Range } from "@/components/articles/ui/range"

import { kernelD, keyAddresses, phi2 } from "./bump"

// A small μLattice: keys are written at continuous 2D addresses
// a = scale · tanh(·), each write allocates the 3 × 3 cells around it, and a
// query reads its own 3 × 3 neighbourhood with the normalised cos² bump
// weights φ. The weights are computed from the exact formula in
// src/mulattice/kernel.py. Density is keys per cell of the (2·scale + 3)²
// box that tanh confines addresses to: the number PAPER.md §5.1 says decides
// recall (0.22 works, 0.49 stalls at 0.96).

const SCALES = [3, 4, 5, 6, 8]
const SIZE = 360

const r2 = (n: number) => Math.round(n * 100) / 100
const r3 = (n: number) => Math.round(n * 1000) / 1000

export function LatticeExplorer() {
  const [si, setSi] = useState(2)
  const [nKeys, setNKeys] = useState(24)
  const [q, setQ] = useState<[number, number]>([0.35, -0.8])
  const scale = SCALES[si]
  const side = 2 * scale + 3
  const lo = -(scale + 1)
  const cellPx = SIZE / side

  const keys = useMemo(() => keyAddresses(nKeys, scale), [nKeys, scale])

  const stats = useMemo(() => {
    const written = new Set<string>()
    const centre = new Map<string, number>()
    for (const [x, y] of keys) {
      for (const c of phi2(x, y)) written.add(`${c.x},${c.y}`)
      const k = `${Math.round(x)},${Math.round(y)}`
      centre.set(k, (centre.get(k) ?? 0) + 1)
    }
    let shared = 0
    for (const [x, y] of keys) {
      if ((centre.get(`${Math.round(x)},${Math.round(y)}`) ?? 0) > 1) shared++
    }
    return { written, shared }
  }, [keys])

  const qCells = phi2(q[0], q[1])
  const overlaps = keys
    .map(([x, y], i) => ({ i, d: kernelD(q[0], q[1], x, y) }))
    .filter((o) => o.d > 0)
    .sort((a, b) => b.d - a.d)

  const density = nKeys / (side * side)
  const sumSq = qCells.reduce((s, c) => s + c.w * c.w, 0)

  const toPx = (v: number) => (v - lo + 0.5) * cellPx
  const fromPx = (p: number) => p / cellPx + lo - 0.5
  const clamp = (v: number) => Math.max(-scale, Math.min(scale, v))

  function onPointer(ev: PointerEvent<SVGSVGElement>) {
    if (ev.type === "pointermove" && ev.buttons !== 1) return
    const box = ev.currentTarget.getBoundingClientRect()
    const px = ((ev.clientX - box.left) / box.width) * SIZE
    const py = ((ev.clientY - box.top) / box.height) * SIZE
    setQ([r2(clamp(fromPx(px))), r2(clamp(fromPx(py)))])
  }

  const cells: { x: number; y: number }[] = []
  for (let gx = lo; gx < lo + side; gx++) for (let gy = lo; gy < lo + side; gy++) cells.push({ x: gx, y: gy })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one head, one lattice · scale {scale} → {side} × {side} = {side * side} cells
        </span>
        <div className="flex gap-1">
          {SCALES.map((v, i) => (
            <button
              key={v}
              type="button"
              onClick={() => setSi(i)}
              aria-pressed={i === si}
              className={`cursor-pointer rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                i === si ? "border-foreground/40 text-foreground" : "border-transparent text-muted-foreground hover:border-foreground/25"
              }`}
            >
              s={v}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-[minmax(0,360px)_1fr]">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full max-w-[360px] touch-none select-none rounded-md border bg-background"
          role="img"
          aria-label={`Lattice of ${side * side} cells with ${nKeys} keys; ${stats.written.size} cells allocated; the query reads nine cells around (${q[0]}, ${q[1]}).`}
          onPointerDown={onPointer}
          onPointerMove={onPointer}
        >
          {cells.map((c) => {
            const on = stats.written.has(`${c.x},${c.y}`)
            return (
              <rect
                key={`${c.x},${c.y}`}
                x={r2((c.x - lo) * cellPx + 0.5)}
                y={r2((c.y - lo) * cellPx + 0.5)}
                width={r2(cellPx - 1)}
                height={r2(cellPx - 1)}
                rx={1.5}
                fill={on ? "oklch(0.62 0.08 250 / 0.28)" : "transparent"}
                stroke="currentColor"
                strokeOpacity={0.08}
              />
            )
          })}
          {qCells.map((c) =>
            c.w > 0 ? (
              <rect
                key={`q${c.x},${c.y}`}
                x={r2((c.x - lo) * cellPx + 0.5)}
                y={r2((c.y - lo) * cellPx + 0.5)}
                width={r2(cellPx - 1)}
                height={r2(cellPx - 1)}
                rx={1.5}
                fill="oklch(0.68 0.17 45)"
                fillOpacity={r3(0.12 + 0.8 * c.w)}
              />
            ) : null,
          )}
          {keys.map(([x, y], i) => (
            <circle key={i} cx={r2(toPx(x))} cy={r2(toPx(y))} r={2.6} fill="oklch(0.5 0.15 265)" />
          ))}
          <circle cx={r2(toPx(q[0]))} cy={r2(toPx(q[1]))} r={5} fill="none" stroke="oklch(0.6 0.2 30)" strokeWidth={2} />
        </svg>

        <div className="space-y-3 font-mono text-[11px]">
          <Slider label="keys written" value={nKeys} min={0} max={160} onChange={setNKeys} shown={`${nKeys}`} />
          <Slider label="query x" value={q[0]} min={-scale} max={scale} step={0.05} onChange={(v) => setQ([r2(v), q[1]])} shown={`${r2(q[0])}`} />
          <Slider label="query y" value={q[1]} min={-scale} max={scale} step={0.05} onChange={(v) => setQ([q[0], r2(v)])} shown={`${r2(q[1])}`} />

          <div>
            <div className="mb-1 text-muted-foreground">query weights φ (rows y, columns x) · Σφ² = {r3(sumSq)}</div>
            <div className="grid w-fit grid-cols-3 gap-1">
              {[0, 1, 2].map((row) =>
                [0, 1, 2].map((col) => {
                  const c = qCells[col * 3 + row]
                  return (
                    <div
                      key={`${row}-${col}`}
                      className="rounded border px-1.5 py-1 text-center tabular-nums"
                      style={{ background: `oklch(0.68 0.17 45 / ${r3(0.08 + 0.6 * c.w)})` }}
                      title={`cell (${c.x}, ${c.y})`}
                    >
                      {c.w === 0 ? "0" : r3(c.w).toFixed(3)}
                    </div>
                  )
                }),
              )}
            </div>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">cells allocated</dt>
            <dd className="tabular-nums">
              {stats.written.size} of {side * side}
            </dd>
            <dt className="text-muted-foreground">keys per cell</dt>
            <dd className={`tabular-nums ${density > 0.25 ? "text-red-600 dark:text-red-400" : ""}`}>
              {r3(density)} {density > 0.25 ? "· past the ~0.25 ceiling" : ""}
            </dd>
            <dt className="text-muted-foreground">keys sharing a centre cell</dt>
            <dd className="tabular-nums">
              {stats.shared} of {nKeys}
            </dd>
            <dt className="text-muted-foreground">keys the query overlaps</dt>
            <dd className="tabular-nums">
              {overlaps.length}
              {overlaps.length > 0 ? ` · strongest D(q,k) = ${r3(overlaps[0].d)}` : ""}
            </dd>
          </dl>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-sm leading-6 text-muted-foreground">
        Drag on the grid or use the sliders to move the query. Shaded blue cells exist because some key wrote to them;
        everything else is never allocated. The nine orange cells are what the query reads, weighted by φ. Every query
        touches at most nine cells however many keys are stored; what grows is how many other keys share those cells.
        Key positions here are random, not learned, so the collision rate is the birthday-problem rate the trained model
        beats with its spread loss.
      </figcaption>
    </figure>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  shown,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  shown: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{shown}</span>
      </div>
      <Range min={min} max={max} step={step} value={value} onChange={(ev) => onChange(+ev.target.value)} className="w-full" aria-label={label} />
    </div>
  )
}

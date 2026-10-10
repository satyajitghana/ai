"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

import { buildImage, COLS, cosine, ROWS, search, softArgmax, truth, type Cell } from "./toy-scene"

// Correspondence explorer. Click a cell of toy image A; the heatmap over toy
// image B is the cosine similarity between that cell's feature and every cell
// of B. Three ways of turning the heatmap into one match are drawn on top:
//
//   local argmax    best cell inside a window around the same coordinates:
//                   the small-motion prior of classical flow, made explicit
//   global argmax   best cell anywhere in B
//   soft-argmax     softmax-weighted mean position over all of B, the kind of
//                   single blended answer a regression head gives
//
// The images and features are toy data built in ./toy-scene.ts, not
// FreeMatching outputs. Transcendentals go through lib/dmath so the server and
// the browser serialize the same SVG.

const CELL = 10
const W = COLS * CELL
const H = ROWS * CELL
const TAU = 0.05

const HEAT = "oklch(0.62 0.24 25)"
const LOCAL = "oklch(0.75 0.16 75)"
const GLOBAL = "oklch(0.6 0.19 255)"
const SOFT = "oklch(0.66 0.17 150)"

const PRESETS = [
  { id: "tip", label: "star, upper tip", x: 6, y: 3 },
  { id: "side", label: "star, right side", x: 8, y: 6 },
  { id: "ring", label: "ring", x: 24, y: 2 },
  { id: "bg", label: "background", x: 14, y: 12 },
] as const

function hashUnit(x: number, y: number, seed: number) {
  let h = Math.imul(x + 7, 2654435761) ^ Math.imul(y + 3, 2246822519) ^ seed
  h = Math.imul(h ^ (h >>> 15), 2246822507)
  h ^= h >>> 13
  return ((h >>> 0) % 1000) / 1000
}

function cellColour(c: Cell, img: "A" | "B", x: number, y: number, edit: number) {
  const n = hashUnit(x, y, img === "A" ? 5 : 9)
  if (c.obj === "bg") {
    return img === "A"
      ? `oklch(${(0.55 + 0.08 * n).toFixed(3)} 0.11 140)`
      : `oklch(${(0.9 + 0.05 * n).toFixed(3)} 0.02 230)`
  }
  // Shade by the object's own coordinates, so rotation and scale are visible.
  const l = 0.58 + 0.14 * c.u - 0.06 * c.v
  if (c.obj === "ring") return `oklch(${l.toFixed(3)} 0.15 300)`
  const hue = img === "B" ? 55 - 70 * edit + 30 * edit * (n - 0.5) : 55
  return `oklch(${l.toFixed(3)} 0.17 ${hue.toFixed(1)})`
}

function fmt(p: { x: number; y: number }) {
  return `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`
}

export function CorrespondenceExplorer() {
  const [q, setQ] = useState<{ x: number; y: number }>({ x: 6, y: 3 })
  const [motion, setMotion] = useState(0.7)
  const [radius, setRadius] = useState(4)
  const [edit, setEdit] = useState(0.3)
  const [duplicate, setDuplicate] = useState(false)

  const opts = useMemo(() => ({ motion, edit, duplicate }), [motion, edit, duplicate])
  const A = useMemo(() => buildImage("A", opts), [opts])
  const B = useMemo(() => buildImage("B", opts), [opts])

  const query = A[q.y * COLS + q.x]
  const sim = useMemo(() => B.map((c) => cosine(query.f, c.f)), [B, query])
  const t = useMemo(() => truth(q.x, q.y, opts), [q, opts])
  const loc = search(sim, q.x, q.y, radius)
  const glo = search(sim, q.x, q.y, null)
  const soft = softArgmax(sim, TAU)
  const err = (p: { x: number; y: number }) => (t ? Math.sqrt((p.x - t.x) ** 2 + (p.y - t.y) ** 2) : null)

  const cx = (x: number) => x * CELL + CELL / 2
  const rows = [
    { name: "local argmax", colour: LOCAL, p: loc, e: err(loc), note: `window ±${radius}, peak ${loc.score.toFixed(2)}` },
    { name: "global argmax", colour: GLOBAL, p: glo, e: err(glo), note: `peak ${glo.score.toFixed(2)}` },
    { name: "soft-argmax", colour: SOFT, p: soft, e: err(soft), note: `τ = ${TAU}` },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>toy correspondence explorer · 32 × 20 cells · toy features, not model output</span>
        <span className="tabular-nums">
          query ({q.x}, {q.y}) · {query.obj === "bg" ? "background" : query.obj}
        </span>
      </div>

      <div className="grid gap-3 px-3 pt-3 sm:grid-cols-2 sm:px-4">
        <div>
          <div className="mb-1 font-mono text-xs text-muted-foreground">image A (source) · click a cell</div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Toy image A: an orange diamond at the upper left and a violet ring at the upper right, on green ground. The query cell is at column ${q.x}, row ${q.y}.`}
            className="w-full cursor-crosshair rounded-sm"
          >
            {A.map((c, i) => {
              const x = i % COLS
              const y = (i - x) / COLS
              return (
                <rect
                  key={i}
                  x={x * CELL}
                  y={y * CELL}
                  width={CELL}
                  height={CELL}
                  fill={cellColour(c, "A", x, y, 0)}
                  onClick={() => setQ({ x, y })}
                />
              )
            })}
            <rect
              x={q.x * CELL - 1}
              y={q.y * CELL - 1}
              width={CELL + 2}
              height={CELL + 2}
              fill="none"
              stroke="black"
              strokeWidth="2.5"
              pointerEvents="none"
            />
            <rect
              x={q.x * CELL}
              y={q.y * CELL}
              width={CELL}
              height={CELL}
              fill="none"
              stroke="white"
              strokeWidth="1.2"
              pointerEvents="none"
            />
          </svg>
        </div>

        <div>
          <div className="mb-1 font-mono text-xs text-muted-foreground">image B (the edit) · similarity to the query</div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Toy image B with the similarity heatmap. ${t ? `True match at ${fmt(t)}.` : "The query has no true match in B."} Local argmax at (${loc.x}, ${loc.y}), global argmax at (${glo.x}, ${glo.y}), soft-argmax at ${fmt(soft)}.`}
            className="w-full rounded-sm"
          >
            {B.map((c, i) => {
              const x = i % COLS
              const y = (i - x) / COLS
              return <rect key={i} x={x * CELL} y={y * CELL} width={CELL} height={CELL} fill={cellColour(c, "B", x, y, edit)} />
            })}
            {sim.map((s, i) => {
              if (s <= 0.3) return null
              const x = i % COLS
              const y = (i - x) / COLS
              const a = 0.85 * mpow((s - 0.3) / 0.7, 3)
              return <rect key={`h${i}`} x={x * CELL} y={y * CELL} width={CELL} height={CELL} fill={HEAT} opacity={a.toFixed(3)} />
            })}
            <rect
              x={Math.max(0, q.x - radius) * CELL}
              y={Math.max(0, q.y - radius) * CELL}
              width={(Math.min(COLS - 1, q.x + radius) - Math.max(0, q.x - radius) + 1) * CELL}
              height={(Math.min(ROWS - 1, q.y + radius) - Math.max(0, q.y - radius) + 1) * CELL}
              fill="none"
              stroke={LOCAL}
              strokeWidth="2"
              strokeDasharray="5 3"
            />
            {t && (
              <circle cx={cx(t.x)} cy={cx(t.y)} r="7" fill="none" stroke="black" strokeWidth="2" strokeDasharray="2 2" />
            )}
            <rect x={cx(loc.x) - 4} y={cx(loc.y) - 4} width="8" height="8" fill={LOCAL} stroke="black" strokeWidth="1" />
            <g stroke={GLOBAL} strokeWidth="2.5">
              <line x1={cx(glo.x) - 5} y1={cx(glo.y) - 5} x2={cx(glo.x) + 5} y2={cx(glo.y) + 5} />
              <line x1={cx(glo.x) - 5} y1={cx(glo.y) + 5} x2={cx(glo.x) + 5} y2={cx(glo.y) - 5} />
            </g>
            <path
              d={`M${cx(soft.x).toFixed(2)},${(cx(soft.y) - 5).toFixed(2)} l5,5 l-5,5 l-5,-5 z`}
              fill={SOFT}
              stroke="black"
              strokeWidth="1"
            />
          </svg>
        </div>
      </div>

      <div className="border-t px-4 py-3">
        <dl className="mb-3 grid grid-cols-1 gap-x-4 gap-y-2 font-mono text-xs tabular-nums sm:grid-cols-4">
          <div className="flex flex-col">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block size-2.5 rounded-full border-2 border-dashed border-foreground" />
              true match
            </dt>
            <dd className="text-foreground">{t ? fmt(t) : "none (no counterpart)"}</dd>
          </div>
          {rows.map((r) => (
            <div key={r.name} className="flex flex-col">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-block size-2 rounded-sm" style={{ background: r.colour }} />
                {r.name}
              </dt>
              <dd className="text-foreground">
                {fmt(r.p)} · {r.e === null ? "n/a" : `off by ${r.e.toFixed(1)}`}
              </dd>
              <dd className="text-muted-foreground">{r.note}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>how far the edit moved things</span>
              <span className="tabular-nums text-foreground">{Math.round(motion * 100)}%</span>
            </div>
            <Range
              min={0}
              max={1}
              step={0.05}
              value={motion}
              onChange={(e) => setMotion(parseFloat(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="how far the edit moved the objects, percent of the full move"
              accent={HEAT}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>search window (small-motion prior)</span>
              <span className="tabular-nums text-foreground">±{radius} cells</span>
            </div>
            <Range
              min={1}
              max={10}
              step={1}
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value, 10))}
              className="w-full cursor-pointer"
              aria-label="half-width of the local search window in cells"
              accent={LOCAL}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>appearance change on the star</span>
              <span className="tabular-nums text-foreground">{Math.round(edit * 100)}%</span>
            </div>
            <Range
              min={0}
              max={1}
              step={0.05}
              value={edit}
              onChange={(e) => setEdit(parseFloat(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="how much the edit changed the star's appearance, percent"
              accent={SOFT}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setQ({ x: p.x, y: p.y })}
              aria-pressed={q.x === p.x && q.y === p.y}
              className={`rounded-md border px-2.5 py-1 hover:bg-muted ${q.x === p.x && q.y === p.y ? "bg-muted" : ""}`}
            >
              {p.label}
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={duplicate} onChange={(e) => setDuplicate(e.target.checked)} />
            the edit adds a second star
          </label>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every cell carries a made-up feature that encodes which object it belongs to and where it
          sits inside that object, so a point keeps its feature wherever the edit moves it. The
          heatmap is the cosine similarity between the query and every cell of B. The dashed amber
          box is a small-motion prior: look for the match only near the same coordinates. At 0% motion
          it works. Past a few cells of motion the true match is outside the box and the local argmax
          settles on the best of a bad neighbourhood. The global argmax finds it anywhere. Tick the
          second star and the global search has two equally good answers; the soft-argmax, which
          averages them, lands between the two stars on empty snow. A background query has no
          counterpart at all, because the edit replaced the ground: that is what a covisibility mask
          is for.
        </p>
      </div>
    </figure>
  )
}

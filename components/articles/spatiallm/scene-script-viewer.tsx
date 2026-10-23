"use client"

import { useMemo, useState } from "react"

import { mcos, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { BEDROOM, NUM_BINS, minCorner, parse, serialize, type Layout, type Shift } from "./scene-script"

// SpatialLM's output, as text you can edit, drawn as a floor plan. The preset
// is a real ground-truth layout from the SpatialLM-Testset (scene0001_01, a
// bedroom). "metres" is the file inference.py writes; "bins" is what the
// language model generates before decoding: every number an integer in
// [0, 1280), positions shifted to be non-negative. The parser follows
// spatiallm/layout/layout.py, including what it silently drops.

const W = 560
const H = 400
const PAD = 26

const START = parse(BEDROOM, false, { x: 0, y: 0, z: 0 })
const SHIFT: Shift = minCorner(START)

const HUES = [25, 60, 145, 200, 250, 290, 330, 100]
const col = (k: number, l = 0.62, c = 0.14) => `oklch(${l} ${c} ${HUES[k % HUES.length]})`

const f = (v: number, d = 2) => v.toFixed(d)

function bounds(L: Layout) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const add = (x: number, y: number) => {
    x0 = Math.min(x0, x)
    x1 = Math.max(x1, x)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  for (const w of L.walls) {
    add(w.ax, w.ay)
    add(w.bx, w.by)
  }
  for (const b of L.boxes) {
    const r = Math.max(b.sx, b.sy) / 2
    add(b.x - r, b.y - r)
    add(b.x + r, b.y + r)
  }
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: 4, y1: 4 }
  return { x0, y0, x1: Math.max(x1, x0 + 0.5), y1: Math.max(y1, y0 + 0.5) }
}

export function SceneScriptViewer() {
  const [bins, setBins] = useState(false)
  const [text, setText] = useState(BEDROOM)
  const [showCls, setShowCls] = useState(true)

  const L = useMemo(() => parse(text, bins, SHIFT), [text, bins])
  const B = useMemo(() => bounds(L), [L])

  const s = Math.min((W - 2 * PAD) / (B.x1 - B.x0), (H - 2 * PAD - 18) / (B.y1 - B.y0))
  // World y points "up" on a plan; SVG y points down.
  const px = (x: number) => PAD + (x - B.x0) * s
  const py = (y: number) => H - PAD - (y - B.y0) * s

  function switchMode(next: boolean) {
    if (next === bins) return
    setText(serialize(L, next, SHIFT))
    setBins(next)
  }

  const tokens = useMemo(() => {
    // Qwen2.5's pre-tokenizer splits every digit into its own token, so the
    // digit count is a floor on the output length.
    return { digits: (text.match(/[0-9]/g) ?? []).length }
  }, [text])

  const bed = L.boxes.find((b) => b.cls === "bed")
  const wallLen = L.walls.reduce((a, w) => a + Math.sqrt((w.bx - w.ax) ** 2 + (w.by - w.ay) ** 2), 0)

  const desc = `Floor plan drawn from ${L.walls.length} walls, ${L.openings.length} doors and windows and ${L.boxes.length} object boxes parsed from the scene script; ${L.skipped.length} lines skipped.${
    bed ? ` The bed box is ${f(bed.sx)} by ${f(bed.sy)} metres.` : ""
  }`

  const btn = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>scene script → floor plan</span>
        <span className="text-muted-foreground/60">SpatialLM-Testset scene0001_01 · parser from layout.py</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3">
        <div className="flex gap-1.5" role="group" aria-label="Number format">
          <button type="button" aria-pressed={!bins} onClick={() => switchMode(false)} className={btn(!bins)}>
            metres (saved file)
          </button>
          <button type="button" aria-pressed={bins} onClick={() => switchMode(true)} className={btn(bins)}>
            bins (what the LLM writes)
          </button>
        </div>
        <button type="button" aria-pressed={showCls} onClick={() => setShowCls((v) => !v)} className={btn(showCls)}>
          labels
        </button>
        <button
          type="button"
          onClick={() => {
            setBins(false)
            setText(BEDROOM)
          }}
          className={btn(false)}
        >
          reset
        </button>
      </div>

      <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <label htmlFor="spatiallm-script" className="mb-1 block font-mono text-[10px] text-muted-foreground">
            edit any line; the plan redraws
          </label>
          <textarea
            id="spatiallm-script"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            wrap="off"
            className="h-[340px] w-full resize-y rounded-md border bg-background/60 p-2 font-mono text-[10.5px] leading-[1.45] text-foreground"
          />
        </div>

        <div className="min-w-0 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" role="img" aria-label={desc}>
            <title>{desc}</title>
            {/* boxes first, walls over them */}
            {L.boxes.map((b, k) => {
              const c = mcos(b.angle)
              const sn = msin(b.angle)
              const hx = b.sx / 2
              const hy = b.sy / 2
              const pts = [
                [-hx, -hy],
                [hx, -hy],
                [hx, hy],
                [-hx, hy],
              ]
                .map(([u, v]) => `${f(px(b.x + u * c - v * sn), 1)},${f(py(b.y + u * sn + v * c), 1)}`)
                .join(" ")
              return (
                <g key={`b${b.id}-${k}`}>
                  <polygon points={pts} fill={col(k, 0.7, 0.12)} fillOpacity={0.22} stroke={col(k, 0.55, 0.16)} strokeWidth={1.2} />
                  {showCls ? (
                    <text x={f(px(b.x), 1)} y={f(py(b.y) + 3, 1)} textAnchor="middle" fontSize={8.5} className="font-mono" fill={col(k, 0.45, 0.16)}>
                      {b.cls}
                    </text>
                  ) : null}
                </g>
              )
            })}
            {L.walls.map((w) => (
              <g key={`w${w.id}`}>
                <line x1={f(px(w.ax), 1)} y1={f(py(w.ay), 1)} x2={f(px(w.bx), 1)} y2={f(py(w.by), 1)} stroke="currentColor" className="text-foreground" strokeWidth={4} strokeLinecap="round" />
                {showCls ? (
                  <text x={f((px(w.ax) + px(w.bx)) / 2 + 4, 1)} y={f((py(w.ay) + py(w.by)) / 2 - 4, 1)} fontSize={8} className="fill-muted-foreground font-mono">
                    wall_{w.id}
                  </text>
                ) : null}
              </g>
            ))}
            {L.openings.map((o) => {
              const w = L.walls.find((x) => x.id === o.wall)
              if (!w) return null
              const len = Math.sqrt((w.bx - w.ax) ** 2 + (w.by - w.ay) ** 2) || 1
              const ux = (w.bx - w.ax) / len
              const uy = (w.by - w.ay) / len
              const h = o.width / 2
              const isDoor = o.kind === "door"
              return (
                <g key={`${o.kind}${o.id}`}>
                  <line
                    x1={f(px(o.x - ux * h), 1)}
                    y1={f(py(o.y - uy * h), 1)}
                    x2={f(px(o.x + ux * h), 1)}
                    y2={f(py(o.y + uy * h), 1)}
                    stroke={isDoor ? "oklch(0.62 0.17 30)" : "oklch(0.62 0.13 230)"}
                    strokeWidth={7}
                  />
                  {showCls ? (
                    <text x={f(px(o.x) + 6, 1)} y={f(py(o.y) + 12, 1)} fontSize={8.5} className="font-mono" fill={isDoor ? "oklch(0.55 0.17 30)" : "oklch(0.55 0.13 230)"}>
                      {o.kind}_{o.id} · {f(o.width)} m
                    </text>
                  ) : null}
                </g>
              )
            })}
            {/* 1 m scale bar */}
            <g className="font-mono" fontSize={8.5}>
              <line x1={PAD} y1={H - 10} x2={f(PAD + s, 1)} y2={H - 10} stroke="currentColor" className="text-muted-foreground" strokeWidth={1.5} />
              <text x={f(PAD + s + 6, 1)} y={H - 7} className="fill-muted-foreground">
                1 m
              </text>
            </g>
          </svg>

          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10.5px] text-muted-foreground">
            <dt>records drawn</dt>
            <dd className="text-foreground">
              {L.walls.length} walls · {L.openings.length} openings · {L.boxes.length} boxes
            </dd>
            <dt>total wall length</dt>
            <dd className="text-foreground">{f(wallLen)} m</dd>
            <dt>bed footprint</dt>
            <dd className="text-foreground">{bed ? `${f(bed.sx)} × ${f(bed.sy)} m` : "no bed record"}</dd>
            <dt>digits in the script</dt>
            <dd className="text-foreground">
              {tokens.digits} (each one a token in Qwen2.5)
            </dd>
            <dt>grid step</dt>
            <dd className="text-foreground">
              {f((32 / NUM_BINS) * 100, 1)} cm per bin, {NUM_BINS} bins
            </dd>
          </dl>
          {L.skipped.length > 0 ? (
            <ul className="mt-2 space-y-0.5 font-mono text-[10px] text-amber-700 dark:text-amber-400">
              {L.skipped.slice(0, 6).map((sk, i) => (
                <li key={i} className="truncate">
                  skipped: {sk.why} · <span className="opacity-70">{sk.line.slice(0, 48)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        A real ground-truth layout from the SpatialLM-Testset (scene0001_01, CC-BY-NC-4.0), parsed with the rules of the repo&apos;s{" "}
        <code>layout.py</code>. Switching to bins re-encodes every number the way <code>entity.py</code> does (positions shifted by the
        room&apos;s own min corner here; a real run shifts by the point cloud&apos;s), so switching back shows the 2.5 cm quantisation. A
        wall with seven numbers, or a door on a wall that has not appeared yet, is skipped, as the Python skips it.
      </figcaption>
    </figure>
  )
}

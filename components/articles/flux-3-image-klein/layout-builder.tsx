"use client"

import { useRef, useState } from "react"
import type { KeyboardEvent, PointerEvent } from "react"

import { cn } from "@/lib/utils"

// Draw boxes, get the exact text FLUX 3 Image Klein's DiT reads.
//
// Everything here mirrors the reference code at
// github.com/black-forest-labs/flux-3-image-klein @ 45e57c9:
//
//   src/flux3/bbox.py  to_canvas(): a box is [y_min, x_min, y_max, x_max] in
//                      0-1 (top-left origin); each value is clamped to 0-1,
//                      multiplied by SCALE = 1000 and rounded. A generation row
//                      is {"id", "bbox", "desc"}; an edit row is {"id", "from",
//                      "src_bbox", "tgt_bbox", "desc"}, "from" being
//                      "ref_image_<n>" or "target".
//   src/flux3/generate.py with --no-pup: the DiT prompt is
//                      f"{prompt.rstrip()} {json.dumps(rows)}". json.dumps uses
//                      ", " and ": " separators, which JSON.stringify does not,
//                      so the rows are serialised by hand below.
//   bbox.is_finished(): a prompt whose box table is cited in full as <id> in the
//                      caption is a finished upsampler answer and goes to the
//                      DiT as typed; otherwise the default path runs the prompt
//                      upsampler first.
//
// The grid is 0-1000 on both axes whatever the aspect ratio (BFL's model page),
// so the canvas below stretches with the aspect and the numbers do not.
// Integer arithmetic only; nothing here needs lib/dmath.

type Box = { id: string; desc: string; y0: number; x0: number; y1: number; x1: number }
type Mode = "generate" | "edit"
type Drag = { index: number; kind: "move" | "resize"; px: number; py: number; start: Box }

const ASPECTS = [
  { key: "1:1", w: 1000, h: 1000, px: "1024 × 1024" },
  { key: "3:2", w: 1500, h: 1000, px: "1248 × 832" },
  { key: "2:3", w: 1000, h: 1500, px: "832 × 1248" },
  { key: "16:9", w: 1600, h: 900, px: "1360 × 768" },
]

const START: Box[] = [
  { id: "obj_1", desc: "a red and yellow striped hot-air balloon", y0: 80, x0: 60, y1: 480, x1: 380 },
  { id: "obj_2", desc: "a small blue hot-air balloon", y0: 200, x0: 620, y1: 420, x1: 800 },
]

const COLORS = ["#ff4fa3", "#3ad1ff", "#ffc23a", "#7cf29a", "#b48cff", "#ff8a4c"]
const MIN = 40 // smallest side, in grid units, so a box stays grabbable
const ID_RE = /^[A-Za-z][A-Za-z0-9_]*$/

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const q = (s: string) => JSON.stringify(s)
const unit = (v: number) => String(v / 1000)
const arr = (b: number[]) => `[${b.join(", ")}]`

function row(b: Box, mode: Mode): string {
  const box = arr([b.y0, b.x0, b.y1, b.x1])
  if (mode === "generate") return `{"id": ${q(b.id)}, "bbox": ${box}, "desc": ${q(b.desc)}}`
  return `{"id": ${q(b.id)}, "from": "target", "src_bbox": null, "tgt_bbox": ${box}, "desc": ${q(b.desc)}}`
}

function cliRow(b: Box, mode: Mode): string {
  const box = arr([unit(b.y0), unit(b.x0), unit(b.y1), unit(b.x1)].map(Number))
  if (mode === "generate") return `{"id": ${q(b.id)}, "desc": ${q(b.desc)}, "bbox": ${box}}`
  return `{"id": ${q(b.id)}, "desc": ${q(b.desc)}, "from": "target", "src_bbox": null, "tgt_bbox": ${box}}`
}

export function LayoutBuilder() {
  const [aspect, setAspect] = useState("1:1")
  const [mode, setMode] = useState<Mode>("generate")
  const [caption, setCaption] = useState("hot-air balloons over a green valley at sunrise")
  const [boxes, setBoxes] = useState<Box[]>(START)
  const [sel, setSel] = useState(0)
  const drag = useRef<Drag | null>(null)
  const svg = useRef<SVGSVGElement | null>(null)

  const a = ASPECTS.find((x) => x.key === aspect) ?? ASPECTS[0]
  const sx = a.w / 1000
  const sy = a.h / 1000

  const update = (i: number, next: Box) => setBoxes((bs) => bs.map((b, j) => (j === i ? next : b)))

  const toGrid = (clientX: number, clientY: number) => {
    const r = svg.current?.getBoundingClientRect()
    if (!r || r.width === 0 || r.height === 0) return { gx: 0, gy: 0 }
    return { gx: ((clientX - r.left) / r.width) * 1000, gy: ((clientY - r.top) / r.height) * 1000 }
  }

  const onDown = (e: PointerEvent<SVGElement>, index: number, kind: Drag["kind"]) => {
    e.stopPropagation()
    e.preventDefault()
    const { gx, gy } = toGrid(e.clientX, e.clientY)
    drag.current = { index, kind, px: gx, py: gy, start: boxes[index] }
    setSel(index)
    svg.current?.setPointerCapture(e.pointerId)
  }

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d) return
    const { gx, gy } = toGrid(e.clientX, e.clientY)
    const dx = Math.round(gx - d.px)
    const dy = Math.round(gy - d.py)
    const s = d.start
    if (d.kind === "move") {
      const w = s.x1 - s.x0
      const h = s.y1 - s.y0
      const x0 = clamp(s.x0 + dx, 0, 1000 - w)
      const y0 = clamp(s.y0 + dy, 0, 1000 - h)
      update(d.index, { ...s, x0, y0, x1: x0 + w, y1: y0 + h })
    } else {
      update(d.index, { ...s, x1: clamp(s.x1 + dx, s.x0 + MIN, 1000), y1: clamp(s.y1 + dy, s.y0 + MIN, 1000) })
    }
  }

  const onUp = (e: PointerEvent<SVGSVGElement>) => {
    if (drag.current && svg.current?.hasPointerCapture(e.pointerId)) svg.current.releasePointerCapture(e.pointerId)
    drag.current = null
  }

  const onKey = (e: KeyboardEvent<SVGElement>, i: number) => {
    const step = e.altKey ? 1 : 10
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const v = map[e.key]
    if (!v) return
    e.preventDefault()
    const b = boxes[i]
    if (e.shiftKey) {
      update(i, { ...b, x1: clamp(b.x1 + v[0], b.x0 + MIN, 1000), y1: clamp(b.y1 + v[1], b.y0 + MIN, 1000) })
    } else {
      const w = b.x1 - b.x0
      const h = b.y1 - b.y0
      const x0 = clamp(b.x0 + v[0], 0, 1000 - w)
      const y0 = clamp(b.y0 + v[1], 0, 1000 - h)
      update(i, { ...b, x0, y0, x1: x0 + w, y1: y0 + h })
    }
  }

  const add = () => {
    if (boxes.length >= 6) return
    let n = boxes.length + 1
    while (boxes.some((b) => b.id === `obj_${n}`)) n += 1
    setBoxes([...boxes, { id: `obj_${n}`, desc: "describe this element", y0: 600, x0: 400, y1: 900, x1: 700 }])
    setSel(boxes.length)
  }

  const remove = () => {
    if (boxes.length <= 1) return
    setBoxes(boxes.filter((_, j) => j !== sel))
    setSel(0)
  }

  const cited = boxes.filter((b) => caption.includes(`<${b.id}>`)).length
  const finished = cited === boxes.length
  const badIds = boxes.filter((b) => !ID_RE.test(b.id)).map((b) => b.id)
  const dupes = boxes.filter((b, i) => boxes.findIndex((c) => c.id === b.id) !== i).map((b) => b.id)

  const ditPrompt = `${caption.trimEnd()} [${boxes.map((b) => row(b, mode)).join(", ")}]`
  const cliJson = `[${boxes.map((b) => cliRow(b, mode)).join(",\n ")}]`

  const tagFirstMissing = () => {
    const missing = boxes.find((b) => !caption.includes(`<${b.id}>`))
    if (missing) setCaption(`${caption.trimEnd()} <${missing.id}>`)
  }

  const cur = boxes[sel] ?? boxes[0]

  return (
    <figure className="my-8 overflow-hidden rounded-md border" aria-label="Bounding-box layout builder for FLUX 3 Image Klein">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 font-mono text-xs">
        <span className="text-muted-foreground">canvas</span>
        {ASPECTS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setAspect(x.key)}
            className={cn("rounded border px-2 py-0.5", x.key === aspect ? "bg-foreground text-background" : "hover:bg-muted")}
            aria-pressed={x.key === aspect}
          >
            {x.key}
          </button>
        ))}
        <span className="ml-2 text-muted-foreground">rows</span>
        {(["generate", "edit"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn("rounded border px-2 py-0.5", m === mode ? "bg-foreground text-background" : "hover:bg-muted")}
            aria-pressed={m === mode}
          >
            {m === "generate" ? "generate (bbox)" : "edit: insert (tgt_bbox)"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div>
          <svg
            ref={svg}
            viewBox={`0 0 ${a.w} ${a.h}`}
            className="w-full touch-none select-none rounded border bg-neutral-900"
            style={{ aspectRatio: `${a.w} / ${a.h}` }}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            role="group"
            aria-label={`Canvas ${a.key}, grid 0 to 1000 on both axes`}
          >
            {[250, 500, 750].map((g) => (
              <g key={g} stroke="#ffffff" strokeOpacity={0.08}>
                <line x1={g * sx} x2={g * sx} y1={0} y2={a.h} />
                <line y1={g * sy} y2={g * sy} x1={0} x2={a.w} />
              </g>
            ))}
            {boxes.map((b, i) => {
              const c = COLORS[i % COLORS.length]
              const x = b.x0 * sx
              const y = b.y0 * sy
              const w = (b.x1 - b.x0) * sx
              const h = (b.y1 - b.y0) * sy
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill={c}
                    fillOpacity={i === sel ? 0.22 : 0.1}
                    stroke={c}
                    strokeWidth={i === sel ? 8 : 4}
                    className="cursor-move outline-none"
                    tabIndex={0}
                    role="button"
                    aria-label={`${b.id}: top ${b.y0}, left ${b.x0}, bottom ${b.y1}, right ${b.x1}. Arrow keys move, shift and arrows resize.`}
                    onPointerDown={(e) => onDown(e, i, "move")}
                    onFocus={() => setSel(i)}
                    onKeyDown={(e) => onKey(e, i)}
                  />
                  <text x={x + 12} y={y + 44} fill={c} fontSize={38} fontFamily="ui-monospace, monospace" pointerEvents="none">
                    {b.id}
                  </text>
                  <rect
                    x={x + w - 36}
                    y={y + h - 36}
                    width={36}
                    height={36}
                    fill={c}
                    className="cursor-nwse-resize"
                    onPointerDown={(e) => onDown(e, i, "resize")}
                  />
                </g>
              )
            })}
          </svg>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            drag a box to move it, its corner to resize; or focus it and use the arrow keys (shift resizes, alt
            steps by 1). {a.key} renders at e.g. {a.px}; the grid stays 0 to 1000.
          </p>
        </div>

        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="font-mono text-xs text-muted-foreground">caption</span>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border bg-transparent p-2 font-mono text-xs"
            />
          </label>
          {cur ? (
            <div className="grid grid-cols-[5rem_1fr] items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">id</span>
              <input
                value={cur.id}
                onChange={(e) => update(sel, { ...cur, id: e.target.value })}
                className="rounded border bg-transparent px-2 py-1 font-mono text-xs"
                aria-label="Selected box id"
              />
              <span className="font-mono text-xs text-muted-foreground">desc</span>
              <input
                value={cur.desc}
                onChange={(e) => update(sel, { ...cur, desc: e.target.value })}
                className="rounded border bg-transparent px-2 py-1 font-mono text-xs"
                aria-label="Selected box description"
              />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            <button type="button" onClick={add} className="rounded border px-2 py-0.5 hover:bg-muted" disabled={boxes.length >= 6}>
              + box
            </button>
            <button type="button" onClick={remove} className="rounded border px-2 py-0.5 hover:bg-muted" disabled={boxes.length <= 1}>
              − selected
            </button>
            <button type="button" onClick={tagFirstMissing} className="rounded border px-2 py-0.5 hover:bg-muted" disabled={finished}>
              cite next &lt;id&gt; in caption
            </button>
          </div>
          <p className={cn("rounded border px-2 py-1 font-mono text-xs", finished ? "border-emerald-500/50" : "border-amber-500/50")}>
            {cited} of {boxes.length} ids cited as &lt;id&gt; in the caption.{" "}
            {finished
              ? "Pasted whole as the prompt, the right-hand text passes is_finished() and skips the upsampler even when it is on."
              : "With --boxes, the 9B upsampler rewrites the caption first and keeps your boxes locked; with --no-pup the DiT gets the right-hand text."}
          </p>
          {badIds.length > 0 || dupes.length > 0 ? (
            <p className="font-mono text-xs text-red-500">
              {badIds.length > 0 ? `ids must match [A-Za-z][A-Za-z0-9_]*: ${badIds.join(", ")}. ` : ""}
              {dupes.length > 0 ? `duplicate ids: ${dupes.join(", ")}.` : ""}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-0 border-t md:grid-cols-2">
        <div className="border-b p-4 md:border-r md:border-b-0">
          <div className="mb-1 font-mono text-xs text-muted-foreground">
            boxes.json for <code>cli.py --boxes</code> (0 to 1)
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-[11px] leading-snug">
            {cliJson}
          </pre>
        </div>
        <div className="p-4">
          <div className="mb-1 font-mono text-xs text-muted-foreground">
            what the DiT reads with <code>--no-pup</code> (0 to 1000 grid)
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-[11px] leading-snug">
            {ditPrompt}
          </pre>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        The box format is plain text. It is tokenized by Qwen3-VL-4B with the rest of the caption; the DiT has no
        box input of its own. Row shapes and rounding follow <code>src/flux3/bbox.py</code> in the reference code.
      </figcaption>
    </figure>
  )
}

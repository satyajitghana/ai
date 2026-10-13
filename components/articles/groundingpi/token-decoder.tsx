"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// GroundingPI's output protocol ("GAM"), encoded and decoded in the browser.
//
// Grammar, from grounding_pi/protocol.py in the release repository:
//   answer  := entry (", " entry)*
//   entry   := <|object_ref_start|> phrase <|object_ref_end|> <|box_start|> payload <|box_end|>
//   payload := "None" | tuple ("," tuple)*
//   tuple   := coord coord | coord coord coord coord
//   coord   := "<0>" … "<999>"   (one atomic vocabulary entry each, ids 151669–152668)
//
// Coordinates (paper, Section 7.1): a value v on an intermediate 0..1000 grid is
// mapped to q = floor((999 v + 500) / 1000); pixels come back as q / 999 × the
// image dimension. How pixels reach the 0..1000 grid is not spelled out; this
// widget rounds to nearest, which is the obvious reading.
//
// Every number here is + − × ÷, Math.round or Math.floor — exact under IEEE-754,
// so nothing needs lib/dmath to hydrate identically.

const BASE_W = 1280
const BASE_H = 720

const REF_S = "<|object_ref_start|>"
const REF_E = "<|object_ref_end|>"
const BOX_S = "<|box_start|>"
const BOX_E = "<|box_end|>"
const IM_END = "<|im_end|>"

type Obj = {
  id: string
  label: string
  box: [number, number, number, number]
  pt: [number, number]
  text?: string
}

// The scene, in a 1280×720 frame. Boxes are tight; points sit on the body of
// each object, which is what the pointing benchmarks score (point-in-mask).
const OBJECTS: Obj[] = [
  { id: "mugA", label: "mug", box: [180, 430, 300, 590], pt: [232, 515] },
  { id: "apple", label: "apple", box: [420, 500, 510, 590], pt: [465, 548] },
  { id: "drv", label: "screwdriver", box: [560, 555, 800, 600], pt: [690, 578] },
  { id: "mugB", label: "mug", box: [860, 450, 960, 580], pt: [905, 520] },
  { id: "book", label: "book", box: [1000, 380, 1210, 600], pt: [1100, 490] },
  { id: "sign", label: "sign", box: [520, 90, 760, 200], pt: [640, 145], text: "OPEN" },
]

const CATEGORIES = ["mug", "apple", "screwdriver", "book", "car"] as const

type Task = "box" | "point" | "ocr"

const TASKS: { id: Task; label: string }[] = [
  { id: "box", label: "boxes" },
  { id: "point", label: "points" },
  { id: "ocr", label: "OCR" },
]

const toGrid = (px: number, dim: number) => Math.round((1000 * px) / dim)
const toToken = (v: number) => Math.floor((999 * v + 500) / 1000)
const fromToken = (q: number, dim: number) => (q / 999) * dim

const INK = "oklch(0.55 0.17 300)"
const READ = "oklch(0.62 0.16 150)"

type Parsed = {
  entries: { label: string; tuples: number[][] | null }[]
  errors: string[]
}

function parse(text: string): Parsed {
  const errors: string[] = []
  const entries: Parsed["entries"] = []
  let body = text.trim()
  if (body.endsWith(IM_END)) body = body.slice(0, -IM_END.length)
  else if (body.length) errors.push("no <|im_end|>: the client would mark this truncated and invalid")
  const re = /<\|object_ref_start\|>([\s\S]*?)<\|object_ref_end\|><\|box_start\|>([\s\S]*?)<\|box_end\|>/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const gap = body.slice(last, m.index)
    if (entries.length === 0 ? gap.trim() !== "" : gap !== ", ")
      errors.push(`unexpected text between entries: "${gap}"`)
    last = m.index + m[0].length
    const label = m[1]
    const payload = m[2]
    if (payload === "None") {
      entries.push({ label, tuples: null })
      continue
    }
    const tuples: number[][] = []
    for (const chunk of payload.split(",")) {
      if (!/^(<\d+>)+$/.test(chunk)) {
        errors.push(`"${label}": "${chunk}" is not a run of coordinate tokens (no spaces allowed)`)
        continue
      }
      const nums = [...chunk.matchAll(/<(\d+)>/g)].map((x) => Number(x[1]))
      if (nums.some((n) => n > 999)) {
        errors.push(`"${label}": a coordinate above <999> is not in the vocabulary`)
        continue
      }
      if (nums.length !== 2 && nums.length !== 4) {
        errors.push(`"${label}": ${nums.length} coordinates; a point has 2, a box 4`)
        continue
      }
      if (nums.length === 4 && (nums[2] <= nums[0] || nums[3] <= nums[1])) {
        errors.push(`"${label}": inverted or empty box; the protocol rejects it`)
        continue
      }
      tuples.push(nums)
    }
    entries.push({ label, tuples })
  }
  const tail = body.slice(last)
  if (tail.trim() !== "") errors.push(`trailing text not inside an entry: "${tail}"`)
  if (!entries.length && body.trim() !== "") errors.push("no complete entry found")
  return { entries, errors }
}

export function TokenDecoder() {
  const [task, setTask] = useState<Task>("box")
  const [query, setQuery] = useState<string[]>(["mug", "car"])
  const [width, setWidth] = useState(BASE_W)
  const [focus, setFocus] = useState<string>("mugA")
  const [draft, setDraft] = useState<string | null>(null)

  const W = width
  const H = Math.round((width * BASE_H) / BASE_W)
  const s = W / BASE_W

  const prompt =
    task === "ocr"
      ? "OCR task detect all the text in box format."
      : task === "box"
        ? `Locate all the instances that match the following categories: ${query.join("</c>")}.`
        : `Point to: ${query.join("</c>")}.`

  const generated = useMemo(() => {
    const enc = (vals: number[]) =>
      vals.map((px, i) => `<${toToken(toGrid(px * s, i % 2 === 0 ? W : H))}>`).join("")
    if (task === "ocr") {
      const signs = OBJECTS.filter((o) => o.text)
      return signs.map((o) => `${REF_S}${o.text}${REF_E}${BOX_S}${enc(o.box)}${BOX_E}`).join(", ") + IM_END
    }
    const entries = query.map((cat) => {
      const hits = OBJECTS.filter((o) => o.label === cat)
      if (!hits.length) return `${REF_S}${cat}${REF_E}${BOX_S}None${BOX_E}`
      // instances inside one wrapper are sorted: boxes by x1, points by x
      const sorted = [...hits].sort((a, b) => (task === "box" ? a.box[0] - b.box[0] : a.pt[0] - b.pt[0]))
      const tuples = sorted.map((o) => enc(task === "box" ? o.box : o.pt)).join(",")
      return `${REF_S}${cat}${REF_E}${BOX_S}${tuples}${BOX_E}`
    })
    return entries.join(", ") + IM_END
  }, [task, query, s, W, H])

  const text = draft ?? generated
  const parsed = useMemo(() => parse(text), [text])

  const tokenCount = useMemo(() => {
    const special = (text.match(/<\|[a-z_]+\|>/g) ?? []).length
    const coords = (text.match(/<\d+>/g) ?? []).length
    return { special, coords }
  }, [text])

  const toggle = (cat: string) => {
    setDraft(null)
    setQuery((q) => (q.includes(cat) ? q.filter((c) => c !== cat) : [...q, cat]))
  }

  const clickObject = (o: Obj) => {
    setFocus(o.id)
    setDraft(null)
    if (o.text) {
      setTask("ocr")
      return
    }
    if (task === "ocr") setTask("box")
    if (!query.includes(o.label)) setQuery((q) => [...q, o.label])
  }

  const fo = OBJECTS.find((o) => o.id === focus) ?? OBJECTS[0]
  const foVals = task === "point" && !fo.text ? fo.pt : fo.box
  const rows = foVals.map((px, i) => {
    const dim = i % 2 === 0 ? W : H
    const p = px * s
    const v = toGrid(p, dim)
    const q = toToken(v)
    const back = fromToken(q, dim)
    return { name: task === "point" && !fo.text ? ["x", "y"][i] : ["x1", "y1", "x2", "y2"][i], p, v, q, back }
  })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">GAM protocol · encode and decode</span>
        <div className="flex flex-wrap gap-1">
          {TASKS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTask(t.id)
                setDraft(null)
              }}
              aria-pressed={task === t.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                task === t.id
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${BASE_W} ${BASE_H}`}
          className="w-full rounded-lg border"
          role="img"
          aria-label="A drawn tabletop: two mugs, an apple, a screwdriver and a book on a table, and a sign reading OPEN on the wall. Outlines show the geometry decoded from the token string below."
        >
          <rect x={0} y={0} width={BASE_W} height={BASE_H} fill="#efe9df" />
          <rect x={0} y={360} width={BASE_W} height={360} fill="#d8c3a1" />
          <rect x={0} y={355} width={BASE_W} height={10} fill="#bfa47c" />
          {/* sign */}
          <rect x={520} y={90} width={240} height={110} rx={10} fill="#2f5d50" />
          <text x={640} y={163} textAnchor="middle" fontSize={56} fontWeight={700} fill="#f3efe6" fontFamily="ui-monospace, monospace">
            OPEN
          </text>
          {/* mug A */}
          <path d="M300 470 q 45 0 45 40 q 0 40 -45 40" fill="none" stroke="#b5483a" strokeWidth={14} />
          <rect x={180} y={430} width={120} height={160} rx={10} fill="#c95a4a" />
          {/* apple */}
          <circle cx={465} cy={550} r={42} fill="#9fb83a" />
          <path d="M465 508 q 4 -10 14 -14" stroke="#5c4a2a" strokeWidth={5} fill="none" />
          {/* screwdriver */}
          <rect x={560} y={560} width={90} height={36} rx={14} fill="#e0a526" />
          <rect x={650} y={572} width={150} height={12} rx={4} fill="#8c939a" />
          {/* mug B */}
          <path d="M860 480 q -35 0 -35 34 q 0 34 35 34" fill="none" stroke="#3c6aa8" strokeWidth={12} />
          <rect x={860} y={450} width={100} height={130} rx={10} fill="#4a7cc0" />
          {/* book */}
          <rect x={1000} y={380} width={210} height={220} rx={6} fill="#6b4f8a" />
          <rect x={1000} y={380} width={26} height={220} rx={4} fill="#55396f" />
          <rect x={1050} y={430} width={130} height={14} rx={4} fill="#d9cde6" />

          {OBJECTS.map((o) => (
            <rect
              key={o.id}
              x={o.box[0]}
              y={o.box[1]}
              width={o.box[2] - o.box[0]}
              height={o.box[3] - o.box[1]}
              fill="transparent"
              stroke={focus === o.id ? INK : "transparent"}
              strokeWidth={3}
              strokeDasharray="8 6"
              className="cursor-pointer"
              onClick={() => clickObject(o)}
            >
              <title>{o.text ? `sign: ${o.text}` : o.label}</title>
            </rect>
          ))}

          {parsed.entries.flatMap((e, ei) =>
            (e.tuples ?? []).map((t, ti) => {
              const x = (n: number) => (fromToken(n, W) / s)
              const y = (n: number) => (fromToken(n, H) / s)
              if (t.length === 4)
                return (
                  <g key={`${ei}-${ti}`} pointerEvents="none">
                    <rect x={x(t[0])} y={y(t[1])} width={x(t[2]) - x(t[0])} height={y(t[3]) - y(t[1])} fill="none" stroke={READ} strokeWidth={4} />
                    <rect x={x(t[0])} y={y(t[1]) - 30} width={Math.max(60, e.label.length * 15 + 16)} height={28} fill={READ} />
                    <text x={x(t[0]) + 8} y={y(t[1]) - 9} fontSize={20} fill="#fff" fontFamily="ui-monospace, monospace">
                      {e.label}
                    </text>
                  </g>
                )
              return (
                <g key={`${ei}-${ti}`} pointerEvents="none">
                  <circle cx={x(t[0])} cy={y(t[1])} r={12} fill={READ} stroke="#fff" strokeWidth={4} />
                  <text x={x(t[0]) + 18} y={y(t[1]) - 14} fontSize={20} fill="#1f2a24" fontFamily="ui-monospace, monospace">
                    {e.label}
                  </text>
                </g>
              )
            }),
          )}
        </svg>

        {task !== "ocr" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">query:</span>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggle(c)}
                aria-pressed={query.includes(c)}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
                  query.includes(c) ? "border-foreground/30 bg-muted/60 text-foreground" : "text-muted-foreground",
                )}
              >
                {c}
                {c === "car" ? " (absent)" : ""}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <div className="font-mono text-[10px] text-muted-foreground">user prompt</div>
          <div className="break-all font-mono text-[11px] leading-5 text-foreground">{prompt}</div>
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">
              assistant output · edit it and the green outlines follow
            </span>
            {draft !== null && (
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
              >
                reset
              </button>
            )}
          </div>
          <textarea
            value={text}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            rows={4}
            aria-label="GroundingPI output token string"
            className="w-full resize-y rounded-lg border bg-background px-3 py-2 font-mono text-[11px] leading-5 text-foreground"
          />
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
            {tokenCount.coords} coordinate tokens + {tokenCount.special} protocol tokens, plus the labels&apos; own text
            tokens
          </div>
          {parsed.errors.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {parsed.errors.map((e, i) => (
                <li key={i} className="font-mono text-[10px] text-red-600 dark:text-red-400">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-[11px]" style={{ color: INK }}>
              {fo.text ? `sign "${fo.text}"` : fo.label}: pixel → 0..1000 → token → pixel
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              image {W}×{H} · one token step = {(W / 999).toFixed(2)} px wide
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[10px] tabular-nums">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="pr-2 text-left font-normal">coord</th>
                  <th className="pr-2 text-right font-normal">pixel</th>
                  <th className="pr-2 text-right font-normal">v (0..1000)</th>
                  <th className="pr-2 text-right font-normal">token</th>
                  <th className="pr-2 text-right font-normal">decoded</th>
                  <th className="text-right font-normal">error px</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td className="pr-2">{r.name}</td>
                    <td className="pr-2 text-right">{r.p.toFixed(1)}</td>
                    <td className="pr-2 text-right">{r.v}</td>
                    <td className="pr-2 text-right" style={{ color: INK }}>{`<${r.q}>`}</td>
                    <td className="pr-2 text-right">{r.back.toFixed(1)}</td>
                    <td className="text-right">{(r.back - r.p).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="mt-2 flex items-center gap-3">
            <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">image width</span>
            <Range min={640} max={3840} step={320} value={width} onChange={(e) => { setWidth(Number(e.target.value)); setDraft(null) }} />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums">{W}</span>
          </label>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          Click an object to add its category to the query, or the sign to switch to OCR. Every coordinate is one
          vocabulary entry, so a box costs four tokens however large the image is, and the price of that is resolution:
          the grid has 1,000 steps per axis, so at 3840 px wide one step is 3.84 px. The query&apos;s order sets the
          entry order; two mugs share one wrapper, sorted left to right; the car is answered with{" "}
          <code>None</code> rather than silence.
        </p>
      </div>
    </figure>
  )
}

"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// A port of Leviathan's card builder (src/card.rs + src/render.rs at commit
// 702ea92) running on one record shaped like the benchmark's synthetic
// maintenance log (bench/synth), mapped with examples/maintenance/leviathan.toml:
//
//   title    = summary, cut at min(max_chars, 240)
//   display  = kind, status, resolution, steps[].text, parts[].name
//              (each joined with "; ", cut at max_chars; <= 40 chars share a line)
//   snippet  = the sentence of searched text, not already on the card, that
//              matches the most distinct query stems, cut at max_chars
//   placeholders ("done", "fixed", ...) count as missing: not shown, not searched
//
// The record is assembled from the generator's own template strings; it is an
// example, not a row from the published run. The token figure is chars / 4,
// a rough rule; the benchmark counts with tiktoken o200k_base.

const STOP = new Set(
  "a an and are as at be been but by did do does for from had has have how i if in into is it its last me my of on or our so that the their then there this time to was we were what when where which who why will with you".split(
    " ",
  ),
)

type Rec = {
  summary: string
  codes: { problem: string; cause: string; action: string }
  resolution: string
  steps: { text: string; note?: string }[]
  parts: { sku: string; name: string }[]
  labor: { note?: string }[]
}

const FIX = "Gearbox oil low and milky; drained, flushed, refilled with ISO 220, scheduled oil analysis"

function record(stub: boolean): Rec {
  return {
    summary:
      "2nd shift: Grinding noise from gearbox on drive side. Root cause likely wear, recommend adding to service plan",
    codes: { problem: "Noise / vibration", cause: "Bearing / gearbox wear", action: "Replaced bearing / gearbox" },
    resolution: stub ? "done" : FIX,
    steps: [
      { text: "Check oil level and condition" },
      {
        text: "Vibration reading on bearings",
        note: "Main shaft bearing failed, replaced both pillow block bearings and aligned shaft",
      },
    ],
    parts: [{ sku: "BRG-UCP-207", name: "Pillow block bearing UCP207" }],
    labor: [{ note: "Ran 30 min no issues" }],
  }
}

const QUERIES = [
  "what fixed grinding noise from gearbox",
  "again bearing squealing",
  "how did we fix high vibration drive end",
  "tech says oil looks milky",
]

const PLACEHOLDERS = new Set(["done", "completed", "fixed", "see notes", "n/a", "ok"])

function present(v: string | undefined): v is string {
  return !!v && v.trim() !== "" && !PLACEHOLDERS.has(v.trim().toLowerCase())
}

function oneLine(s: string) {
  return s.split(/\s+/).filter(Boolean).join(" ")
}

function truncate(s: string, cap: number) {
  const v = s.trim()
  const chars = Array.from(v)
  if (chars.length <= cap) return v
  return `${chars.slice(0, Math.max(0, cap - 1)).join("").trimEnd()}…`
}

function queryWords(q: string) {
  const out: string[] = []
  for (const m of q.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_.-]*/gu) ?? []) {
    const w = m.replace(/[.\-_]+$/, "")
    if (w && !STOP.has(w) && !out.includes(w)) out.push(w)
  }
  return out
}

function stem(w: string) {
  const n = Array.from(w).length
  const keep = n <= 4 ? n : Math.max(n - 2, 4)
  return Array.from(w).slice(0, keep).join("")
}

function sentences(s: string) {
  const out: string[] = []
  let start = 0
  for (let i = 0; i < s.length; i++) {
    if (".!?;".includes(s[i]) && i + 1 < s.length && /\s/.test(s[i + 1])) {
      out.push(s.slice(start, i + 1).trim())
      start = i + 1
    }
  }
  out.push(s.slice(start).trim())
  return out.filter(Boolean)
}

function words(s: string) {
  const out: { pos: number; w: string }[] = []
  const chars = Array.from(s)
  let start = -1
  for (let i = 0; i <= chars.length; i++) {
    const c = chars[i]
    const alnum = c !== undefined && /[\p{L}\p{N}]/u.test(c)
    if (alnum && start < 0) start = i
    if (!alnum && start >= 0) {
      out.push({ pos: start, w: chars.slice(start, i).join("") })
      start = -1
    }
  }
  return out
}

type Line = { kind: "head" | "title" | "field" | "match"; text: string }

function build(rec: Rec, q: string, cap: number) {
  const hl = queryWords(q)
  const stems = hl.map(stem)
  const title = truncate(oneLine(rec.summary), Math.min(cap, 240))
  const shown = [title]

  const display: [string, string[]][] = [
    ["kind", ["corrective"]],
    ["status", ["closed"]],
    ["resolution", [rec.resolution].filter(present)],
    ["steps.text", rec.steps.map((s) => s.text).filter(present)],
    ["parts.name", rec.parts.map((p) => p.name).filter(present)],
  ]
  const fields: [string, string][] = []
  for (const [label, vals] of display) {
    const uniq = [...new Set(vals.map(oneLine))]
    if (!uniq.length) continue
    const joined = uniq.join("; ")
    shown.push(joined)
    fields.push([label, truncate(joined, cap)])
  }

  // Searched text, in the mapping's order, placeholders dropped.
  const texts = [
    rec.summary,
    rec.codes.problem,
    rec.codes.cause,
    rec.codes.action,
    rec.resolution,
    ...rec.steps.map((s) => s.text),
    ...rec.steps.map((s) => s.note),
    ...rec.parts.map((p) => p.sku),
    ...rec.parts.map((p) => p.name),
    ...rec.labor.map((l) => l.note),
  ].filter(present)

  let best: { n: number; seg: string; first: number } | null = null
  for (const t of texts) {
    const flat = oneLine(t)
    if (shown.some((s) => s.includes(flat))) continue
    for (const seg of sentences(flat)) {
      if (shown.some((s) => s.includes(seg))) continue
      const hits = new Set<number>()
      let first = -1
      for (const { pos, w } of words(seg.toLowerCase())) {
        const k = stems.findIndex((s) => w.startsWith(s))
        if (k >= 0) {
          hits.add(k)
          if (first < 0) first = pos
        }
      }
      if (hits.size && (!best || hits.size > best.n)) best = { n: hits.size, seg, first: Math.max(first, 0) }
    }
  }
  let snippet: string | null = null
  if (best) {
    const chars = Array.from(best.seg)
    if (chars.length <= cap) snippet = best.seg
    else {
      const lead = Math.max(0, best.first - 40)
      const cut = truncate(chars.slice(lead).join(""), cap)
      snippet = lead > 0 ? `…${cut}` : cut
    }
  }

  const lines: Line[] = [{ kind: "head", text: "[1] ML-1412087 · 2023-11-15 13:05 · rel (bm25 × boost)" }]
  lines.push({ kind: "title", text: `  ${title}` })
  const short = fields.filter(([, v]) => Array.from(v).length <= 40)
  const long = fields.filter(([, v]) => Array.from(v).length > 40)
  if (short.length) lines.push({ kind: "field", text: `  ${short.map(([k, v]) => `${k}: ${v}`).join(" · ")}` })
  for (const [k, v] of long) lines.push({ kind: "field", text: `  ${k}: ${v}` })
  if (snippet) lines.push({ kind: "match", text: `  match: ${snippet}` })
  return { lines, hl }
}

const RAW_CHARS = (() => {
  // The record as one JSONL line, roughly as grep would print it.
  const r = record(false)
  return JSON.stringify({
    id: "ML-1412087",
    asset: { id: "CMP-B03", name: "Hall B Air Compressor 03" },
    kind: "corrective",
    priority: "high",
    status: "closed",
    opened: "2023-11-14T06:40:00",
    closed: "2023-11-15T13:05:00",
    summary: r.summary,
    codes: r.codes,
    resolution: r.resolution,
    steps: [
      { n: 1, text: r.steps[0].text },
      { n: 2, text: r.steps[1].text, note: r.steps[1].note },
    ],
    parts: [{ sku: "BRG-UCP-207", name: "Pillow block bearing UCP207", qty: 2 }],
    labor: [{ tech: "P. Ivanova", hours: 3.5, note: "Ran 30 min no issues" }],
    hours: 3.5,
    crew: "mechanical",
  }).length
})()

const TONE: Record<Line["kind"], string> = {
  head: "text-foreground",
  title: "text-foreground font-semibold",
  field: "text-muted-foreground",
  match: "text-[oklch(0.6_0.13_190)]",
}

export function CardBuilder() {
  const [q, setQ] = useState(QUERIES[0])
  const [cap, setCap] = useState(300)
  const [n, setN] = useState(5)
  const [stub, setStub] = useState(false)

  const { lines, hl } = build(record(stub), q, cap)
  const chars = lines.reduce((a, l) => a + Array.from(l.text).length + 1, 0)
  // Ceiling per card for this mapping: header, title (<= 240), five display
  // fields at the cap plus their labels, and a snippet at the cap.
  const ceiling = 70 + Math.min(cap, 240) + 5 * (cap + 14) + cap + 9
  const ceilingAll = n * ceiling + 260

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        card builder · one synthetic service record · src/card.rs logic, ported
      </div>
      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {QUERIES.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setQ(x)}
              aria-pressed={q === x}
              className={`cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10.5px] transition-colors ${
                q === x
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          FTS5 query: {hl.map((w) => `"${w}"`).join(" OR ")}
        </div>

        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
              <span>--max-chars (per field and snippet)</span>
              <span className="tabular-nums text-foreground">{cap}</span>
            </span>
            <Range
              min={40}
              max={600}
              step={10}
              value={cap}
              onChange={(e) => setCap(Number(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="Character cap per card field"
            />
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
              <span>-n (cards per answer)</span>
              <span className="tabular-nums text-foreground">{n}</span>
            </span>
            <Range
              min={1}
              max={20}
              step={1}
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="Number of cards per answer"
            />
          </label>
        </div>
        <label className="flex cursor-pointer items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <input type="checkbox" checked={stub} onChange={(e) => setStub(e.target.checked)} />
          the technician wrote &ldquo;done&rdquo; as the resolution (a configured placeholder)
        </label>

        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 font-mono text-[11.5px] leading-relaxed">
          {lines.map((l, i) => (
            <div key={i} className={TONE[l.kind]}>
              {l.text}
            </div>
          ))}
        </pre>

        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground">this card</div>
            <div className="tabular-nums text-foreground">
              {chars} chars ≈ {Math.round(chars / 4)} tok
            </div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground">same record as raw JSONL</div>
            <div className="tabular-nums text-foreground">
              {RAW_CHARS} chars ≈ {Math.round(RAW_CHARS / 4)} tok
            </div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground">ceiling, {n} full cards</div>
            <div className="tabular-nums text-foreground">
              {ceilingAll.toLocaleString("en-US")} chars ≈ {Math.round(ceilingAll / 4).toLocaleString("en-US")} tok
            </div>
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        The record is built from the benchmark generator&rsquo;s templates and is illustrative. Token counts here
        are characters divided by four; the benchmark counts with tiktoken. The ceiling is set by the caps and the
        number of display fields, not by a token budget: Leviathan never counts tokens.
      </figcaption>
    </figure>
  )
}

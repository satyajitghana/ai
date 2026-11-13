"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// A toy static embedder with the same shape as Modern Web Guidance's
// `accumulateNormalizedVector` (src/rag/static-embedder.ts):
//
//   for (const [i, f] of enc) {            // enc: (row, fraction) per known word
//     const wt = scales[i] * f             // per-word weight x Int8 scale, pre-folded
//     for (k ...) out[k] += wt * table[i * D + k]
//   }
//   out /= |out|
//
// The real table is 29,165 words x 256 Int8 dims. This one is 34 words x 2
// dims, written by hand so the sum can be drawn as arrows on a plane. The
// numbers are illustrative: only the arithmetic is the real one.

type Row = { q: [number, number]; w: number }

// q: the Int8 row (each component in -127..127); w: the word's weight (an
// IDF-like number: rare, specific words weigh more than common ones).
const TABLE: Record<string, Row> = {
  dismiss: { q: [125, 20], w: 2.4 },
  modal: { q: [120, 50], w: 2.2 },
  dialog: { q: [122, 40], w: 2.6 },
  prompt: { q: [118, 25], w: 1.5 },
  confirm: { q: [110, -30], w: 1.6 },
  destructive: { q: [115, -10], w: 2.0 },
  delete: { q: [100, -60], w: 1.3 },
  action: { q: [60, 10], w: 0.5 },
  light: { q: [-55, 115], w: 1.1 },
  dark: { q: [-40, 120], w: 1.2 },
  mode: { q: [-80, 100], w: 0.9 },
  theme: { q: [-50, 118], w: 1.4 },
  tooltip: { q: [50, 118], w: 2.3 },
  popover: { q: [60, 112], w: 2.6 },
  anchor: { q: [40, 120], w: 1.8 },
  menu: { q: [70, 100], w: 1.4 },
  animate: { q: [-115, 45], w: 1.5 },
  transition: { q: [-122, 20], w: 1.7 },
  page: { q: [-100, 60], w: 0.6 },
  navigation: { q: [-118, 10], w: 1.6 },
  image: { q: [-60, -110], w: 1.2 },
  hero: { q: [-80, -95], w: 1.6 },
  fetchpriority: { q: [-72, -105], w: 2.8 },
  load: { q: [-40, -115], w: 0.8 },
  fast: { q: [-30, -120], w: 0.7 },
  form: { q: [95, -85], w: 1.3 },
  validation: { q: [85, -95], w: 2.0 },
  error: { q: [100, -70], w: 1.4 },
  input: { q: [80, -100], w: 1.1 },
  message: { q: [70, -40], w: 0.8 },
  make: { q: [20, 30], w: 0.3 },
  button: { q: [100, 20], w: 0.7 },
  close: { q: [110, 60], w: 1.0 },
  open: { q: [80, 90], w: 0.6 },
}

// Guides, as unit-ish directions (the real ones are Gemini vectors, 256-d).
const DOCS: Array<{ id: string; v: [number, number] }> = [
  { id: "dialog", v: [120, 40] },
  { id: "popover", v: [60, 110] },
  { id: "light-dark color-scheme", v: [-50, 115] },
  { id: "view transitions", v: [-120, 30] },
  { id: "image fetchpriority", v: [-70, -100] },
  { id: "form validation", v: [90, -90] },
]

// The same tokenizer and stopword list as bm25.ts in the repo.
const STOP = new Set(
  "the a an and or of to in for with on by is are be as it this that from at use using your you can how when which into not".split(" "),
)
const tokenize = (t: string) => (t.toLowerCase().match(/[a-z0-9][a-z0-9-]+/g) ?? []) as string[]

const PRESETS = ["light dismiss", "dismiss light", "confirm destructive action", "fetchpriority hero image", "dark mode toggle", "animate page navigation"]

const norm = (v: [number, number]) => Math.sqrt(v[0] * v[0] + v[1] * v[1])
const COLORS = ["oklch(0.62 0.16 255)", "oklch(0.66 0.16 150)", "oklch(0.68 0.16 60)", "oklch(0.6 0.18 330)", "oklch(0.62 0.14 200)", "oklch(0.6 0.16 25)"]

export function StaticEmbedDemo() {
  const [text, setText] = useState("light dismiss")

  const { toks, sum, unit, ranked, used } = useMemo(() => {
    const toks = tokenize(text).map((t) => {
      if (STOP.has(t)) return { t, kind: "stop" as const }
      const row = TABLE[t]
      if (!row) return { t, kind: "unknown" as const }
      // scales[i] = w * maxAbs / 127, folded the way the repo stores it
      const maxAbs = Math.max(Math.abs(row.q[0]), Math.abs(row.q[1]))
      const scale = (row.w * maxAbs) / 127
      const add: [number, number] = [scale * row.q[0], scale * row.q[1]]
      return { t, kind: "known" as const, row, scale, add }
    })
    const sum: [number, number] = [0, 0]
    let used = 0
    for (const k of toks) if (k.kind === "known") { sum[0] += k.add[0]; sum[1] += k.add[1]; used++ }
    const n = norm(sum) || 1
    const unit: [number, number] = [sum[0] / n, sum[1] / n]
    const ranked = DOCS.map((d, i) => {
      const dn = norm(d.v)
      return { ...d, i, cos: used ? (unit[0] * d.v[0] + unit[1] * d.v[1]) / dn : 0 }
    }).sort((a, b) => b.cos - a.cos)
    return { toks, sum, unit, ranked, used }
  }, [text])

  // drawing: the plane, docs on the unit circle, arrows head to tail
  const S = 300, C = S / 2, R = 110
  const known = toks.filter((k) => k.kind === "known")
  const maxLen = Math.max(1, ...known.map((k) => norm(k.add)), norm(sum))
  const px = R / maxLen // arrows scaled so the longest fits the circle
  const arrows: Array<{ x0: number; y0: number; x1: number; y1: number; j: number; t: string }> = []
  for (let j = 0; j < known.length; j++) {
    const k = known[j]
    const x0 = j ? arrows[j - 1].x1 : C, y0 = j ? arrows[j - 1].y1 : C
    arrows.push({ x0, y0, x1: x0 + k.add[0] * px, y1: y0 - k.add[1] * px, j, t: k.t })
  }
  const top = used ? ranked[0] : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">a static embedder, 34 words × 2 dims</span>
        <span className="font-mono text-[10px] text-muted-foreground">out = Σ scale · f · row, then ÷ |out|</span>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <label className="block">
          <span className="sr-only">Query</span>
          <input
            aria-label="query"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-foreground/20"
            placeholder="type a 2–5 word query"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setText(p)}
              aria-pressed={text === p}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                text === p ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-[300px_1fr]">
          <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-[300px]" role="img" aria-label="Word rows added head to tail; the sum is normalised onto the circle where the guides sit">
            <circle cx={C} cy={C} r={R} fill="none" stroke="currentColor" strokeOpacity={0.15} />
            <line x1={C - R - 12} y1={C} x2={C + R + 12} y2={C} stroke="currentColor" strokeOpacity={0.08} />
            <line x1={C} y1={C - R - 12} x2={C} y2={C + R + 12} stroke="currentColor" strokeOpacity={0.08} />
            {DOCS.map((d) => {
              const n = norm(d.v)
              const x = C + (d.v[0] / n) * R, y = C - (d.v[1] / n) * R
              const lx = C + (d.v[0] / n) * (R + 14), ly = C - (d.v[1] / n) * (R + 14)
              const hit = top?.id === d.id
              return (
                <g key={d.id}>
                  <circle cx={x} cy={y} r={hit ? 5.5 : 4} fill={hit ? "oklch(0.62 0.16 255)" : "currentColor"} fillOpacity={hit ? 1 : 0.35} />
                  <text x={lx} y={ly} fontSize={9} textAnchor={d.v[0] > 20 ? "start" : d.v[0] < -20 ? "end" : "middle"} dominantBaseline="middle" className="fill-current font-mono" opacity={hit ? 1 : 0.6}>
                    {d.id.length > 14 ? d.id.split(" ")[0] : d.id}
                  </text>
                </g>
              )
            })}
            {arrows.map((a) => (
              <g key={a.j}>
                <line x1={a.x0} y1={a.y0} x2={a.x1} y2={a.y1} stroke={COLORS[a.j % COLORS.length]} strokeWidth={2.5} strokeLinecap="round" />
                <circle cx={a.x1} cy={a.y1} r={2.5} fill={COLORS[a.j % COLORS.length]} />
              </g>
            ))}
            {used > 0 && (
              <>
                <line x1={C} y1={C} x2={C + unit[0] * R} y2={C - unit[1] * R} stroke="currentColor" strokeWidth={1.2} strokeDasharray="3 3" />
                <circle cx={C + unit[0] * R} cy={C - unit[1] * R} r={6} fill="none" stroke="currentColor" strokeWidth={1.5} />
              </>
            )}
          </svg>

          <div className="min-w-0 space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pr-2 font-normal">word</th>
                    <th className="pr-2 font-normal">Int8 row</th>
                    <th className="pr-2 font-normal">scale</th>
                    <th className="font-normal">adds</th>
                  </tr>
                </thead>
                <tbody>
                  {toks.length === 0 && (
                    <tr><td colSpan={4} className="py-1 text-muted-foreground">no words yet</td></tr>
                  )}
                  {toks.map((k, idx) => {
                    const j = known.indexOf(k as (typeof known)[number])
                    return (
                      <tr key={idx} className={k.kind === "known" ? "" : "text-muted-foreground"}>
                        <td className="pr-2">
                          {k.kind === "known" ? <span style={{ color: COLORS[j % COLORS.length] }}>■ </span> : null}
                          <span className={k.kind === "known" ? "" : "line-through"}>{k.t}</span>
                        </td>
                        {k.kind === "known" ? (
                          <>
                            <td className="pr-2">[{k.row.q[0]}, {k.row.q[1]}]</td>
                            <td className="pr-2">{k.scale.toFixed(3)}</td>
                            <td>[{k.add[0].toFixed(1)}, {k.add[1].toFixed(1)}]</td>
                          </>
                        ) : (
                          <td colSpan={3}>{k.kind === "stop" ? "stopword, dropped" : "not in the table, dropped"}</td>
                        )}
                      </tr>
                    )
                  })}
                  {used > 0 && (
                    <tr className="border-t">
                      <td className="pr-2 pt-1">sum</td>
                      <td colSpan={2} className="pr-2 pt-1 text-muted-foreground">÷ |sum| = {norm(sum).toFixed(1)}</td>
                      <td className="pt-1">[{unit[0].toFixed(3)}, {unit[1].toFixed(3)}]</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 font-mono text-[11px]">
              <div className="text-muted-foreground">cosine with each guide</div>
              {ranked.map((d, r) => (
                <div key={d.id} className="flex items-center gap-2">
                  <span className={cn("w-40 shrink-0 truncate", r === 0 && used ? "text-foreground" : "text-muted-foreground")}>{d.id}</span>
                  <div className="h-2 flex-1 rounded-sm bg-muted/40">
                    <div className="h-2 rounded-sm" style={{ width: `${Math.max(0, d.cos) * 100}%`, background: r === 0 && used ? "oklch(0.62 0.16 255)" : "oklch(0.65 0.04 255)" }} />
                  </div>
                  <span className="w-12 text-right">{used ? d.cos.toFixed(3) : "—"}</span>
                </div>
              ))}
            </div>

            <div className="font-mono text-[10px] text-muted-foreground">
              {used} known {used === 1 ? "word" : "words"} × 2 dims = {used * 2} multiply-adds here; × 256 dims = {used * 256} in the real table.
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Toy numbers, real arithmetic. Each known word adds its row times its weight; stopwords and unknown words add nothing; order
          never matters, so <code>light dismiss</code>{" "}and <code>dismiss light</code>{" "}are the same vector. The heavier word wins the
          tug: <code>dismiss</code>{" "}outweighs <code>light</code>, so the pair lands on dialog, not on color-scheme.
        </p>
      </div>
    </figure>
  )
}

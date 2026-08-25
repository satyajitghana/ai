"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The full appendix, sorted by what actually changed.
//
// Fastino publishes per-dataset scores "so regressions are visible alongside
// gains", which is unusually good practice and worth taking them up on. Every
// number below is theirs, transcribed from the appendix table; every average is
// computed here from those numbers rather than quoted, so the arithmetic is
// checkable — the Overall row reproduces their 56.17 / 56.09 / 54.87 / 53.34
// exactly, which is how you know the transcription is right.
//
// The reason to compute rather than quote is the "drop XNLI" control. At the
// 0.3B size the headline is a 0.08-point win, and one dataset moved 24.75
// points. Remove it and the same checkpoint is 1.57 points behind. At 0.2B the
// gain survives the removal. That difference is the whole story of this release
// and it is not visible from the summary line.

const ACCENT = "oklch(0.60 0.15 255)"
const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"

type Row = {
  ds: string
  domain: string
  kind: "cls" | "ext"
  m25: number
  b25: number
  m2: number
  b2: number
}

// GLiNER2.5 blog, appendix — per-dataset macro F1
const ROWS: Row[] = [
  { ds: "xnli", domain: "NLI", kind: "cls", m25: 62.3, b25: 54.49, m2: 37.55, b2: 49.01 },
  { ds: "ag_news", domain: "topic / news", kind: "cls", m25: 70.99, b25: 69.71, m2: 72.93, b2: 70.54 },
  { ds: "clinc_oos", domain: "intent", kind: "cls", m25: 61.32, b25: 62.2, m2: 62.59, b2: 63.62 },
  { ds: "imdb", domain: "sentiment", kind: "cls", m25: 85.96, b25: 88.1, m2: 89.42, b2: 89.7 },
  { ds: "multilingual_sentiment", domain: "sentiment", kind: "cls", m25: 79.42, b25: 63.14, m2: 81.3, b2: 57.57 },
  { ds: "rotten_tomatoes", domain: "sentiment", kind: "cls", m25: 74.67, b25: 81.51, m2: 78.11, b2: 82.91 },
  { ds: "crossner_ai", domain: "CrossNER", kind: "ext", m25: 45.6, b25: 50.69, m2: 50.31, b2: 52.12 },
  { ds: "crossner_literature", domain: "CrossNER", kind: "ext", m25: 51.52, b25: 54.56, m2: 55.06, b2: 56.91 },
  { ds: "crossner_music", domain: "CrossNER", kind: "ext", m25: 65.8, b25: 68.96, m2: 63.06, b2: 64.27 },
  { ds: "crossner_politics", domain: "CrossNER", kind: "ext", m25: 55.26, b25: 56.41, m2: 62.47, b2: 66.52 },
  { ds: "crossner_science", domain: "CrossNER", kind: "ext", m25: 56.08, b25: 60.85, m2: 58.31, b2: 55.47 },
  { ds: "few_nerd", domain: "general NER", kind: "ext", m25: 52.37, b25: 55.14, m2: 51.49, b2: 47.22 },
  { ds: "german_ler", domain: "legal", kind: "ext", m25: 21.16, b25: 11.16, m2: 22.36, b2: 6.88 },
  { ds: "hipe2020", domain: "historical OCR", kind: "ext", m25: 45.46, b25: 39.56, m2: 41.22, b2: 29.45 },
  { ds: "mobie", domain: "disaster", kind: "ext", m25: 30.65, b25: 24.44, m2: 32.47, b2: 29.66 },
  { ds: "ronec", domain: "Romanian NER", kind: "ext", m25: 40.13, b25: 37.01, m2: 38.86, b2: 31.55 },
]

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export function BenchDelta() {
  const [size, setSize] = useState<"multi" | "base">("multi")
  const [dropXnli, setDropXnli] = useState(false)

  const now = (r: Row) => (size === "multi" ? r.m25 : r.b25)
  const before = (r: Row) => (size === "multi" ? r.m2 : r.b2)

  const active = ROWS.filter((r) => !(dropXnli && r.ds === "xnli"))
  const sorted = [...active].sort((a, b) => now(b) - before(b) - (now(a) - before(a)))

  const avg = (kind?: "cls" | "ext") => {
    const set = kind ? active.filter((r) => r.kind === kind) : active
    return { a: mean(set.map(now)), b: mean(set.map(before)), n: set.length }
  }
  const overall = avg()
  const cls = avg("cls")
  const ext = avg("ext")

  const wins = active.filter((r) => now(r) > before(r)).length

  const W = 700
  const ROW_H = 17
  const H = sorted.length * ROW_H + 26
  // The zero line has to clear the label columns by more than the widest
  // negative bar (crossner_politics at -7.21), and leave room to the right for
  // the widest positive one (xnli at +24.75). Every delta value goes in a fixed
  // right-hand column so neither bar direction can run into text.
  const MID = 440
  const SCALE = 8.4 // px per F1 point

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          GLiNER2.5 minus GLiNER2, per dataset, at matched size
        </span>
        <span className="font-mono text-[10px]" style={{ color: overall.a >= overall.b ? GOOD : BAD }}>
          {wins} of {active.length} datasets improve · overall {overall.a >= overall.b ? "+" : ""}
          {(overall.a - overall.b).toFixed(2)}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["multi", "gliner2.5-multi-v1 · 0.3B"],
              ["base", "gliner2.5-base-v1 · 0.2B"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSize(k)}
              aria-pressed={size === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                size === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDropXnli((v) => !v)}
            aria-pressed={dropXnli}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              dropXnli
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            drop XNLI from the average
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { l: `overall · ${overall.n} sets`, ...overall },
            { l: `classification · ${cls.n}`, ...cls },
            { l: `extraction · ${ext.n}`, ...ext },
          ].map((x) => {
            const d = x.a - x.b
            return (
              <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
                <div className="font-mono text-sm tabular-nums text-foreground">
                  {x.a.toFixed(2)}{" "}
                  <span className="text-muted-foreground">vs {x.b.toFixed(2)}</span>
                </div>
                <div className="font-mono text-[10px] tabular-nums" style={{ color: d >= 0 ? GOOD : BAD }}>
                  {d >= 0 ? "+" : ""}
                  {d.toFixed(2)}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A diverging bar chart of the change from GLiNER2 to GLiNER2.5 on ${active.length} datasets at the ${size === "multi" ? "0.3B multilingual" : "0.2B base"} size. ${wins} datasets improve and ${active.length - wins} regress; the overall change is ${(overall.a - overall.b).toFixed(2)} points of macro F1.`}
            </title>

            <line x1={MID} y1={4} x2={MID} y2={H - 20} stroke="currentColor" strokeOpacity={0.3} />
            {[-8, -4, 4, 8, 12, 16, 20, 24].map((t) => (
              <g key={t}>
                <line x1={MID + t * SCALE} y1={4} x2={MID + t * SCALE} y2={H - 20} stroke="currentColor" strokeOpacity={0.07} />
                <text x={MID + t * SCALE} y={H - 8} fontSize={7} textAnchor="middle" fill="currentColor" fillOpacity={0.35} fontFamily="ui-monospace, monospace">
                  {t > 0 ? `+${t}` : t}
                </text>
              </g>
            ))}
            <text x={MID} y={H - 8} fontSize={7} textAnchor="middle" fill="currentColor" fillOpacity={0.35} fontFamily="ui-monospace, monospace">
              0
            </text>

            {sorted.map((r, i) => {
              const d = now(r) - before(r)
              const y = 6 + i * ROW_H
              const colour = d >= 0 ? GOOD : BAD
              const w = Math.abs(d) * SCALE
              return (
                <g key={r.ds}>
                  <rect
                    x={4}
                    y={y + 4}
                    width={6}
                    height={6}
                    rx={1.5}
                    fill={r.kind === "cls" ? ACCENT : "currentColor"}
                    fillOpacity={r.kind === "cls" ? 0.8 : 0.3}
                  />
                  <text x={16} y={y + 10} fontSize={8.5} fill="currentColor" fillOpacity={0.8} fontFamily="ui-monospace, monospace">
                    {r.ds}
                  </text>
                  <text x={186} y={y + 10} fontSize={7.5} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                    {r.domain}
                  </text>
                  <text x={378} y={y + 10} fontSize={7.5} textAnchor="end" fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                    {before(r).toFixed(1)} → {now(r).toFixed(1)}
                  </text>
                  <rect
                    x={d >= 0 ? MID : MID - w}
                    y={y + 2}
                    width={Math.max(1.5, w)}
                    height={10}
                    rx={2}
                    fill={colour}
                    fillOpacity={0.75}
                  />
                  <text x={W - 2} y={y + 10} fontSize={8} textAnchor="end" fill={colour} fontFamily="ui-monospace, monospace">
                    {d >= 0 ? "+" : ""}
                    {d.toFixed(2)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {(
            [
              ["classification set", ACCENT, 0.8],
              ["extraction set", "currentColor", 0.3],
            ] as const
          ).map(([label, colour, op]) => (
            <span key={label} className="flex items-center gap-1.5 font-mono text-[9.5px] text-muted-foreground">
              <span
                className="inline-block h-1.5 w-1.5 rounded-[2px]"
                style={{ background: colour, opacity: op }}
              />
              {label}
            </span>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The summary line for the 0.3B checkpoint is a 0.08-point win, which reads as parity, and
          parity is the correct claim — Fastino frames the whole benchmark section as evidence that
          the new architecture{" "}
          <em>does not trade away</em>{" "}quality, not that it raises it. What the per-dataset table
          adds is where that parity comes from: one dataset moved{" "}
          <span style={{ color: GOOD }}>+24.75</span>{" "}and eleven of the other fifteen went down.
          Press &ldquo;drop XNLI&rdquo; and the 0.3B model is{" "}
          <span style={{ color: BAD }}>1.57 points behind</span>{" "}its predecessor.
          <br />
          <br />
          Now switch to the 0.2B row and press it again.{" "}
          <span className="text-foreground">
            That checkpoint keeps a 1.27-point gain with XNLI removed
          </span>
          {" "}— broad, unglamorous, spread across extraction. Two checkpoints from one release with
          genuinely different stories, and only the appendix tells you which is which.
        </p>
      </div>
    </figure>
  )
}

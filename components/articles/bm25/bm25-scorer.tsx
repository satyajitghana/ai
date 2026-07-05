"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// A real BM25 engine, running in your browser. Edit the query, drag k1 and b, and
// every document is re-scored live with the exact Lucene BM25 formula:
//   score(D,Q) = Σ_q IDF(q) · tf(q,D)·(k1+1) / ( tf(q,D) + k1·(1 − b + b·|D|/avgdl) )
//   IDF(q)     = ln( 1 + (N − df(q) + 0.5)/(df(q) + 0.5) )
// The ranked bars are the live scores; pick a bar to open its per-term breakdown —
// IDF (rarity) × a saturating, length-normalized term-frequency factor.
// Fully server-rendered at the default query, so it degrades to a static ranking.

const CORPUS = [
  "the quick brown fox jumps over the lazy dog",
  "a fox is a quick and clever animal that hunts small prey at night",
  "the lazy dog sleeps all day long in the warm afternoon sun",
  "quick foxes and lazy dogs both appear in many old fables about animals",
  "search engines rank documents by their relevance to a user query",
  "a dog is a loyal animal and a very common household pet worldwide",
]

const tokenize = (s: string): string[] => s.toLowerCase().match(/[a-z]+/g) ?? []

const DOCS = CORPUS.map(tokenize)
const N = DOCS.length
const AVGDL = DOCS.reduce((a, d) => a + d.length, 0) / N
const DF: Record<string, number> = {}
for (const d of DOCS) for (const t of new Set(d)) DF[t] = (DF[t] ?? 0) + 1
const idf = (t: string) => Math.log(1 + (N - (DF[t] ?? 0) + 0.5) / ((DF[t] ?? 0) + 0.5))

const ACCENT = "oklch(0.72 0.15 195)"

// scene geometry (viewBox units)
const W = 600
const TOP = 16
const ROW = 32
const BX = 60 // bar left edge
const BMAX = 470 // max bar width  (BX + BMAX = 530)
const BH = 15
const SCOREX = 592 // right-anchored score column

export function Bm25Scorer() {
  const [query, setQuery] = useState("quick lazy fox")
  const [k1, setK1] = useState(1.2)
  const [b, setB] = useState(0.75)
  const [sel, setSel] = useState<number | null>(0)

  const qTerms = useMemo(() => Array.from(new Set(tokenize(query))), [query])

  const scored = useMemo(() => {
    return DOCS.map((doc, i) => {
      const len = doc.length
      const norm = k1 * (1 - b + (b * len) / AVGDL)
      const parts = qTerms.map((t) => {
        const tf = doc.filter((w) => w === t).length
        const contrib = tf === 0 ? 0 : idf(t) * ((tf * (k1 + 1)) / (tf + norm))
        return { term: t, tf, idf: idf(t), contrib }
      })
      const score = parts.reduce((a, p) => a + p.contrib, 0)
      return { i, len, parts, score }
    }).sort((x, y) => y.score - x.score)
  }, [qTerms, k1, b])

  const maxScore = Math.max(...scored.map((s) => s.score), 1e-9)
  const H = TOP * 2 + scored.length * ROW
  const selRow = sel === null ? null : scored.find((s) => s.i === sel) ?? null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        live BM25 · scores the 6-document corpus against your query
      </div>

      <div className="p-3 sm:p-4">
        {/* query + params */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] text-muted-foreground">query</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border bg-background px-2.5 py-1.5 font-mono text-sm outline-none focus:border-foreground/40"
              placeholder="type a query…"
            />
          </label>
          <div className="flex gap-4">
            <label className="block">
              <span className="mb-1 flex justify-between gap-3 font-mono text-[10px] text-muted-foreground">k1<span className="text-foreground">{k1.toFixed(1)}</span></span>
              <input type="range" min={0} max={3} step={0.1} value={k1} onChange={(e) => setK1(+e.target.value)} className="w-24 cursor-pointer accent-[oklch(0.72_0.15_195)]" aria-label="k1" />
            </label>
            <label className="block">
              <span className="mb-1 flex justify-between gap-3 font-mono text-[10px] text-muted-foreground">b<span className="text-foreground">{b.toFixed(2)}</span></span>
              <input type="range" min={0} max={1} step={0.05} value={b} onChange={(e) => setB(+e.target.value)} className="w-24 cursor-pointer accent-[oklch(0.72_0.15_195)]" aria-label="b" />
            </label>
          </div>
        </div>

        {/* ranked docs — SVG bar chart */}
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`Documents ranked by BM25 score against the query "${query}". Top document scores ${scored[0]?.score.toFixed(2)}.`}>
          <defs>
            <filter id="bm25-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {scored.map((s, rank) => {
            const cy = TOP + rank * ROW + ROW / 2
            const bw = Math.max((s.score / maxScore) * BMAX, s.score > 0 ? 3 : 0)
            const isSel = s.i === sel
            const hasScore = s.score > 0
            return (
              <g key={s.i} onClick={() => setSel(s.i)} className="cursor-pointer">
                {/* hit target */}
                <rect x={0} y={cy - ROW / 2} width={W} height={ROW} fill="transparent" />
                {/* rank + doc label */}
                <text x={10} y={cy + 3.5} className="fill-muted-foreground/70 font-mono" fontSize={10}>{rank + 1}</text>
                <text x={22} y={cy + 3.5} className={cn("font-mono", isSel ? "fill-foreground" : "fill-muted-foreground")} fontSize={10} fontWeight={isSel ? 600 : 400}>doc {s.i + 1}</text>
                {/* track */}
                <rect x={BX} y={cy - BH / 2} width={BMAX} height={BH} rx={4} fill="var(--muted)" opacity={0.35} />
                {/* value bar */}
                {hasScore ? (
                  <rect x={BX} y={cy - BH / 2} width={bw} height={BH} rx={4} fill={ACCENT} opacity={isSel ? 1 : 0.5} filter={isSel ? "url(#bm25-soft)" : undefined} className="transition-all duration-300" />
                ) : null}
                {/* score */}
                <text x={SCOREX} y={cy + 3.5} textAnchor="end" className={cn("font-mono tabular-nums", hasScore ? (isSel ? "fill-foreground" : "fill-muted-foreground") : "fill-muted-foreground/40")} fontSize={11} fontWeight={isSel ? 600 : 400}>{s.score.toFixed(2)}</text>
              </g>
            )
          })}
        </svg>

        {/* detail panel for the selected doc */}
        {selRow ? (
          <div className="mt-3 rounded-lg border bg-muted/20 p-3">
            <div className="text-sm leading-6">
              <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">doc {selRow.i + 1}</span>
              {CORPUS[selRow.i].split(" ").map((word, wi) => {
                const hit = qTerms.includes(word.toLowerCase())
                return (
                  <span key={wi} className={cn(hit ? "rounded px-0.5 font-medium text-foreground" : "text-muted-foreground")} style={hit ? { background: "oklch(0.72 0.15 195 / 0.18)" } : undefined}>
                    {word}{" "}
                  </span>
                )
              })}
            </div>
            <div className="mb-1.5 mt-3 font-mono text-[10px] text-muted-foreground">
              per-term contribution · |D| = {selRow.len} tokens, avgdl = {AVGDL.toFixed(1)}
            </div>
            <div className="space-y-1">
              {selRow.parts.map((p) => {
                const w = maxScore > 0 ? (p.contrib / maxScore) * 100 : 0
                return (
                  <div key={p.term} className="grid grid-cols-[64px_1fr_44px] items-center gap-2 font-mono text-[11px]">
                    <span className="truncate text-foreground">{p.term}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
                        <span className="block h-full rounded" style={{ width: `${w}%`, background: ACCENT, opacity: p.contrib > 0 ? 1 : 0 }} />
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-muted-foreground/80">idf {p.idf.toFixed(2)} · tf {p.tf}{p.tf === 0 ? " · absent" : ""}</span>
                    </span>
                    <span className="text-right tabular-nums" style={{ color: p.contrib > 0 ? ACCENT : "var(--muted-foreground)" }}>{p.contrib.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Each score is a sum over query terms of <span className="text-foreground">rarity</span> (IDF) times a
          term-frequency factor that <span className="text-foreground">saturates</span> (controlled by k1) and is
          <span className="text-foreground"> normalized by document length</span> (controlled by b). Rare query terms
          dominate; repeating a common word barely helps; and long documents don't win just for being long.
        </p>
      </div>
    </figure>
  )
}

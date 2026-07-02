"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// A real BM25 engine, running in your browser. Edit the query, drag k1 and b, and
// every document is re-scored live with the exact Lucene BM25 formula:
//   score(D,Q) = Σ_q IDF(q) · tf(q,D)·(k1+1) / ( tf(q,D) + k1·(1 − b + b·|D|/avgdl) )
//   IDF(q)     = ln( 1 + (N − df(q) + 0.5)/(df(q) + 0.5) )
// The bars show the ranking; expand the top document to see each query term's
// contribution — IDF (rarity) × a saturating, length-normalized term-frequency factor.
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

export function Bm25Scorer() {
  const [query, setQuery] = useState("quick lazy fox")
  const [k1, setK1] = useState(1.2)
  const [b, setB] = useState(0.75)
  const [openIdx, setOpenIdx] = useState<number | null>(0)

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
    }).sort((a, b) => b.score - a.score)
  }, [qTerms, k1, b])

  const maxScore = Math.max(...scored.map((s) => s.score), 1e-9)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">live BM25 · scores the 6-document corpus against your query</div>

      <div className="p-4">
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
              <input type="range" min={0} max={3} step={0.1} value={k1} onChange={(e) => setK1(+e.target.value)} className="w-24 accent-foreground" aria-label="k1" />
            </label>
            <label className="block">
              <span className="mb-1 flex justify-between gap-3 font-mono text-[10px] text-muted-foreground">b<span className="text-foreground">{b.toFixed(2)}</span></span>
              <input type="range" min={0} max={1} step={0.05} value={b} onChange={(e) => setB(+e.target.value)} className="w-24 accent-foreground" aria-label="b" />
            </label>
          </div>
        </div>

        {/* ranked docs */}
        <div className="mt-4 space-y-1.5">
          {scored.map((s, rank) => {
            const open = openIdx === s.i
            return (
              <div key={s.i} className="rounded-md border">
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : s.i)}
                  className="flex w-full items-center gap-3 px-2.5 py-2 text-left"
                >
                  <span className="w-4 shrink-0 font-mono text-[10px] text-muted-foreground">{rank + 1}</span>
                  <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums" style={{ color: s.score > 0 ? ACCENT : "var(--muted-foreground)" }}>
                    {s.score.toFixed(2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-muted-foreground">
                      {CORPUS[s.i].split(" ").map((w, wi) => {
                        const hit = qTerms.includes(w.toLowerCase())
                        return (
                          <span key={wi} className={cn(hit && "rounded px-0.5 font-medium text-foreground")} style={hit ? { background: "oklch(0.72 0.15 195 / 0.18)" } : undefined}>
                            {w}{" "}
                          </span>
                        )
                      })}
                    </span>
                  </span>
                  <span className="hidden h-1.5 w-24 shrink-0 overflow-hidden rounded bg-muted sm:block">
                    <span className="block h-full rounded" style={{ width: `${(s.score / maxScore) * 100}%`, background: ACCENT }} />
                  </span>
                </button>

                {open ? (
                  <div className="border-t bg-muted/20 px-3 py-2.5">
                    <div className="mb-1.5 font-mono text-[10px] text-muted-foreground">
                      per-term contribution · |D| = {s.len} tokens, avgdl = {AVGDL.toFixed(1)}
                    </div>
                    <div className="space-y-1">
                      {s.parts.map((p) => (
                        <div key={p.term} className="grid grid-cols-[70px_1fr_44px] items-center gap-2 font-mono text-[11px]">
                          <span className="text-foreground">{p.term}</span>
                          <span className="text-muted-foreground">
                            idf {p.idf.toFixed(2)} · tf {p.tf}
                            {p.tf === 0 ? " · absent" : ""}
                          </span>
                          <span className="text-right tabular-nums" style={{ color: p.contrib > 0 ? ACCENT : "var(--muted-foreground)" }}>
                            {p.contrib.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

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

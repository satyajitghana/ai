"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// The mechanism the article only describes in prose: the inverted index. BM25 doesn't
// score every document — it keeps a map from term → the list of documents that contain
// it (the postings list), and a query only ever touches the postings of its own terms.
// Everything else is never scored. Pick a query and watch which postings light up and
// how many documents get skipped entirely. Same 6-document corpus as the live scorer.

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

// term -> sorted list of 1-based doc ids that contain it
const INDEX: Record<string, number[]> = {}
DOCS.forEach((doc, i) => {
  for (const t of new Set(doc)) (INDEX[t] ??= []).push(i + 1)
})

const QUERIES = ["quick lazy fox", "dog", "search query", "clever prey animal"]

const ACCENT = "oklch(0.72 0.15 195)"

export function InvertedIndex() {
  const [q, setQ] = useState(QUERIES[0])

  const { terms, candidates } = useMemo(() => {
    const qTerms = Array.from(new Set(tokenize(q)))
    const terms = qTerms.map((t) => ({ term: t, postings: INDEX[t] ?? [] }))
    const candidates = new Set<number>()
    for (const { postings } of terms) for (const d of postings) candidates.add(d)
    return { terms, candidates }
  }, [q])

  const total = CORPUS.length
  const scored = candidates.size
  const skipped = total - scored

  const chip = (active: boolean) =>
    cn(
      "flex h-6 w-6 items-center justify-center rounded-md border font-mono text-[11px] tabular-nums transition-colors",
      active
        ? "border-transparent text-background"
        : "border-dashed border-border text-muted-foreground/40",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        inverted index · a query only touches the postings it hits
      </div>
      <div className="p-3 sm:p-4">
        {/* query presets */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-muted-foreground">query</span>
          {QUERIES.map((query) => {
            const on = query === q
            return (
              <button
                key={query}
                type="button"
                onClick={() => setQ(query)}
                aria-pressed={on}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                  on
                    ? "border-transparent text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                style={on ? { background: ACCENT } : undefined}
              >
                {query}
              </button>
            )
          })}
        </div>

        <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_auto]">
          {/* query terms -> their postings lists */}
          <div className="space-y-2">
            <div className="font-mono text-[10px] text-muted-foreground">
              term → postings list
            </div>
            {terms.map(({ term, postings }) => (
              <div key={term} className="flex flex-wrap items-center gap-1.5">
                <span className="w-16 shrink-0 truncate font-mono text-xs text-foreground">
                  {term}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/60">
                  df {postings.length}
                </span>
                <span className="text-muted-foreground/40">→</span>
                {postings.length ? (
                  postings.map((d) => (
                    <span
                      key={d}
                      className={chip(true)}
                      style={{ background: ACCENT }}
                      title={CORPUS[d - 1]}
                    >
                      {d}
                    </span>
                  ))
                ) : (
                  <span className="font-mono text-[10px] text-muted-foreground/50">
                    not in index — skipped
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* union arrow */}
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <span className="text-lg leading-none" style={{ color: ACCENT }}>
                ∪
              </span>
              <span>union</span>
              <span className="text-base leading-none">→</span>
            </div>
          </div>

          {/* candidate set: all docs, lit if scored, dashed if skipped */}
          <div className="space-y-2">
            <div className="font-mono text-[10px] text-muted-foreground">
              documents scored
            </div>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-3">
              {Array.from({ length: total }, (_, i) => i + 1).map((d) => {
                const on = candidates.has(d)
                return (
                  <span
                    key={d}
                    className={chip(on)}
                    style={on ? { background: ACCENT } : undefined}
                    title={CORPUS[d - 1]}
                  >
                    {d}
                  </span>
                )
              })}
            </div>
            <div className="font-mono text-[11px]">
              <span style={{ color: ACCENT }}>scored {scored}</span>
              <span className="text-muted-foreground"> of {total} · </span>
              <span className="text-muted-foreground/60">{skipped} never touched</span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The index maps each term to its postings list — the documents that contain it — built once
          at index time. A query walks only its own terms' postings and scores their union;{" "}
          {skipped > 0 ? (
            <>
              the other <span className="text-foreground">{skipped}</span> document
              {skipped === 1 ? " is" : "s are"} never opened.
            </>
          ) : (
            <>here every document happens to match at least one term.</>
          )}{" "}
          At web scale that's the difference between scoring a handful of postings and scanning a
          billion documents — and it's the same index Lucene has shipped since 2011.
        </p>
      </div>
    </figure>
  )
}

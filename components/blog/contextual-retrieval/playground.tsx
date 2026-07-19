"use client"

import { useMemo, useState } from "react"

// A client-side Contextual Retrieval playground. Everything runs in the browser:
// BM25, a TF-IDF cosine "semantic" score (a stand-in for a real embedding model),
// and reciprocal rank fusion. The contextual prefixes are pre-written stand-ins for
// what Claude would return for each chunk — no API calls. Step through: the document,
// its chunks, the chunks with context prepended, then retrieve and watch the right
// chunk climb the rankings.

const ACCENT = "oklch(0.60 0.15 250)"

type Chunk = { id: number; doc: string; text: string; context: string }

const DOCS = [
  { key: "acme", title: "ACME Corp — Form 10-Q, quarter ended June 30, 2023" },
  { key: "beta", title: "Beta Industries — Form 10-Q, quarter ended September 30, 2023" },
]

// Two filings in one index. Their chunks mirror each other, so a chunk on its own
// ("Revenue … over the previous quarter") can't say which company it belongs to.
// Contexts are illustrative stand-ins for Claude's output.
const CHUNKS: Chunk[] = [
  { id: 0, doc: "acme", text: "ACME Corp Form 10-Q, quarter ended June 30, 2023.", context: "ACME Corp's Q2 2023 10-Q — filing cover." },
  { id: 1, doc: "acme", text: "ACME Corp is headquartered in Dayton, Ohio.", context: "From ACME Corp's Q2 2023 10-Q, company overview." },
  { id: 2, doc: "acme", text: "It grew 3% over the previous quarter.", context: "From ACME Corp's Q2 2023 10-Q; ACME revenue vs Q1 2023 ($314M)." },
  { id: 3, doc: "acme", text: "It held steady at 12% through the quarter.", context: "From ACME Corp's Q2 2023 10-Q, ACME operating margin." },
  { id: 4, doc: "acme", text: "Management stood by the full-year targets.", context: "From ACME Corp's Q2 2023 10-Q, ACME full-year guidance." },
  { id: 5, doc: "beta", text: "Beta Industries Form 10-Q, quarter ended September 30, 2023.", context: "Beta Industries' Q3 2023 10-Q — filing cover." },
  { id: 6, doc: "beta", text: "Beta Industries is headquartered in Denver, Colorado.", context: "From Beta Industries' Q3 2023 10-Q, company overview." },
  { id: 7, doc: "beta", text: "It declined 5% over the previous quarter.", context: "From Beta Industries' Q3 2023 10-Q; Beta revenue vs Q2 2023." },
  { id: 8, doc: "beta", text: "It slipped to 7% through the quarter.", context: "From Beta Industries' Q3 2023 10-Q, Beta operating margin." },
  { id: 9, doc: "beta", text: "Management lowered the full-year targets.", context: "From Beta Industries' Q3 2023 10-Q, Beta full-year guidance." },
]

type QueryDef = { q: string; short: string; target: number }
const QUERIES: QueryDef[] = [
  { q: "How did ACME Corp revenue change last quarter?", short: "revenue", target: 2 },
  { q: "What was ACME Corp operating margin this quarter?", short: "margin", target: 3 },
  { q: "Did ACME Corp keep its full-year guidance?", short: "guidance", target: 4 },
  { q: "Where is ACME Corp headquartered?", short: "HQ", target: 1 },
]

type Method = "lexical" | "semantic" | "hybrid"

// ---------- tiny retrieval engine (browser) ----------
const tokenize = (s: string): string[] => (s.toLowerCase().match(/[a-z0-9]+/g) ?? [])

function bm25Scores(docs: string[][], query: string[], k1 = 1.5, b = 0.75): number[] {
  const N = docs.length
  const avgdl = docs.reduce((a, d) => a + d.length, 0) / N
  const df = new Map<string, number>()
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1)
  const idf = (t: string) => {
    const n = df.get(t) ?? 0
    return Math.log(1 + (N - n + 0.5) / (n + 0.5))
  }
  return docs.map((d) => {
    const tf = new Map<string, number>()
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1)
    let s = 0
    for (const t of query) {
      const f = tf.get(t)
      if (!f) continue
      s += (idf(t) * (f * (k1 + 1))) / (f + k1 * (1 - b + (b * d.length) / avgdl))
    }
    return s
  })
}

function cosineScores(docs: string[][], query: string[]): number[] {
  const N = docs.length
  const df = new Map<string, number>()
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1)
  const vec = (toks: string[]) => {
    const tf = new Map<string, number>()
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1)
    const v = new Map<string, number>()
    for (const [t, c] of tf) v.set(t, (c / toks.length) * (Math.log((1 + N) / (1 + (df.get(t) ?? 0))) + 1))
    let norm = 0
    for (const x of v.values()) norm += x * x
    norm = Math.sqrt(norm) || 1
    for (const [t, x] of v) v.set(t, x / norm)
    return v
  }
  const qv = vec(query)
  return docs.map((d) => {
    const dv = vec(d)
    let s = 0
    for (const [t, x] of qv) s += x * (dv.get(t) ?? 0)
    return s
  })
}

// order = chunk ids sorted best-first; returns rank map (1-based) by chunk id
function ranksFrom(order: number[]): Map<number, number> {
  const m = new Map<number, number>()
  order.forEach((id, i) => m.set(id, i + 1))
  return m
}

function rrfRanks(orders: number[][], k = 60): number[] {
  const score = new Map<number, number>()
  for (const order of orders) order.forEach((id, i) => score.set(id, (score.get(id) ?? 0) + 1 / (k + i + 1)))
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
}

function rankChunks(indexed: string[], query: string, method: Method): { order: number[]; scores: number[] } {
  const docs = indexed.map(tokenize)
  const q = tokenize(query)
  const lex = bm25Scores(docs, q)
  const sem = cosineScores(docs, q)
  if (method === "hybrid") {
    const lexOrder = [...lex.keys()].sort((a, b) => lex[b] - lex[a])
    const semOrder = [...sem.keys()].sort((a, b) => sem[b] - sem[a])
    const order = rrfRanks([lexOrder, semOrder])
    // a fusion "score" for the bar: reciprocal-rank sum, normalized
    const rr = new Map<number, number>()
    order.forEach((id, i) => rr.set(id, 1 / (i + 1)))
    return { order, scores: indexed.map((_, i) => rr.get(i) ?? 0) }
  }
  const s = method === "lexical" ? lex : sem
  const order = [...s.keys()].sort((a, b) => s[b] - s[a])
  return { order, scores: s }
}

const STEPS = ["1 · document", "2 · chunks", "3 · contextualize", "4 · retrieve"] as const

export function ContextualRetrievalPlayground() {
  const [step, setStep] = useState(3)
  const [qi, setQi] = useState(0)
  const [method, setMethod] = useState<Method>("semantic")

  const query = QUERIES[qi]

  const result = useMemo(() => {
    const plainText = CHUNKS.map((c) => c.text)
    const ctxText = CHUNKS.map((c) => `${c.context}\n${c.text}`)
    const plain = rankChunks(plainText, query.q, method)
    const ctx = rankChunks(ctxText, query.q, method)
    return {
      plain: { ...plain, ranks: ranksFrom(plain.order) },
      ctx: { ...ctx, ranks: ranksFrom(ctx.order) },
    }
  }, [query, method])

  const plainRank = result.plain.ranks.get(query.target) ?? CHUNKS.length
  const ctxRank = result.ctx.ranks.get(query.target) ?? CHUNKS.length
  const maxPlain = Math.max(...result.plain.scores, 1e-6)
  const maxCtx = Math.max(...result.ctx.scores, 1e-6)

  const column = (mode: "plain" | "ctx") => {
    const r = result[mode]
    const max = mode === "plain" ? maxPlain : maxCtx
    return (
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground">{mode === "plain" ? "standard chunks" : "contextual chunks"}</span>
          <span className="font-mono text-[10px]" style={{ color: mode === "ctx" ? ACCENT : "var(--muted-foreground)" }}>
            answer at #{mode === "plain" ? plainRank : ctxRank}
          </span>
        </div>
        <ol className="space-y-1.5">
          {r.order.map((id, i) => {
            const c = CHUNKS[id]
            const isTarget = id === query.target
            const score = r.scores[id]
            const w = Math.max(2, (score / max) * 100)
            return (
              <li
                key={id}
                className={"rounded-md border px-2.5 py-1.5 " + (isTarget ? "border-transparent" : "border-border/70")}
                style={isTarget ? { borderColor: ACCENT, background: "color-mix(in oklch, " + ACCENT + " 10%, transparent)" } : undefined}
              >
                <div className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{i + 1}</span>
                  <span className={"min-w-0 flex-1 truncate text-[12px] " + (isTarget ? "text-foreground" : "text-muted-foreground")}>
                    {mode === "ctx" ? <span style={{ color: ACCENT }}>{c.context} </span> : null}
                    {c.text}
                  </span>
                </div>
                <div className="mt-1 ml-6 h-1 rounded-full bg-muted">
                  <div className="h-1 rounded-full" style={{ width: `${w}%`, background: isTarget ? ACCENT : "var(--muted-foreground)" }} />
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    )
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>contextual retrieval · playground</span>
        <span className="text-muted-foreground/50">runs in your browser</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* step tabs */}
        <div className="flex flex-wrap gap-1.5">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              aria-pressed={step === i}
              className={
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[10px] transition-colors " +
                (step === i ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          {step === 0 && (
            <div className="space-y-3">
              {DOCS.map((d) => (
                <div key={d.key} className="rounded-lg border bg-background p-3">
                  <div className="mb-2 font-mono text-[11px] text-muted-foreground">{d.title}</div>
                  <div className="space-y-1 text-sm leading-6">
                    {CHUNKS.filter((c) => c.doc === d.key).map((c) => (
                      <p key={c.id} className="text-foreground/90">{c.text}</p>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs leading-5 text-muted-foreground">Two filings in one index. RAG never sees either whole — only the chunks below, each on its own. Both filings say &quot;Revenue … over the previous quarter&quot;, which is the trap.</p>
            </div>
          )}

          {(step === 1 || step === 2) && (
            <div className="space-y-1.5">
              {CHUNKS.map((c) => (
                <div key={c.id} className="rounded-md border bg-background px-3 py-2 text-[13px] leading-6">
                  <span className="mr-2 font-mono text-[10px] text-muted-foreground">#{c.id}</span>
                  {step === 2 && <span style={{ color: ACCENT }}>{c.context} </span>}
                  <span className="text-foreground/90">{c.text}</span>
                </div>
              ))}
              <p className="pt-1 text-xs leading-5 text-muted-foreground">
                {step === 1
                  ? "Look at #2 and #7: \"It grew / declined … over the previous quarter\" — no subject, no company, no period. A query about ACME's revenue has nothing here to match."
                  : "Each chunk now carries a one-line context (the accent text) — what Claude writes given the whole filing. \"ACME revenue Q2 2023\" vs \"Beta revenue Q3 2023\" are back, so retrieval can separate them."}
              </p>
            </div>
          )}

          {step === 3 && (
            <div>
              {/* controls */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground">query</span>
                  {QUERIES.map((qd, i) => (
                    <button
                      key={qd.q}
                      type="button"
                      onClick={() => setQi(i)}
                      aria-pressed={qi === i}
                      className={
                        "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors " +
                        (qi === i ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")
                      }
                    >
                      {qd.short}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground">method</span>
                  {(["lexical", "semantic", "hybrid"] as Method[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      aria-pressed={method === m}
                      className={
                        "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors " +
                        (method === m ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")
                      }
                    >
                      {m === "lexical" ? "BM25" : m === "semantic" ? "embed" : "hybrid"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-2 rounded-md border-l-2 px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: ACCENT }}>
                <span className="text-muted-foreground">query:</span> <span className="text-foreground">{query.q}</span>
              </div>

              {/* two columns */}
              <div className="mt-3 flex flex-col gap-4 sm:flex-row">
                {column("plain")}
                {column("ctx")}
              </div>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The right chunk moves from{" "}
                <span className="text-foreground">#{plainRank}</span> on standard chunks to{" "}
                <span style={{ color: ACCENT }}>#{ctxRank}</span> once each chunk carries its context —{" "}
                {plainRank > ctxRank ? `${plainRank - ctxRank} places higher` : "no worse"}. Scores are a real in-browser BM25 and a
                TF-IDF cosine standing in for an embedding model; contextual prefixes stand in for Claude's output.
              </p>
            </div>
          )}
        </div>
      </div>
    </figure>
  )
}

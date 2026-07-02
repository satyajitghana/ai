"use client"

import { useState } from "react"

// BM25's second fix: document-length normalization, the b knob. Two documents mention
// a query term the SAME number of times, but one is short and one is long. Without
// normalization they'd score equally — yet the term is a bigger share of the short
// document, so it's more likely to be about it. BM25 divides the saturation term by
//   (1 − b + b·|D|/avgdl)
// so a longer-than-average document is penalized. Drag b from 0 (ignore length) to 1
// (full normalization) and watch the long document's score fall. Static-friendly.

const K1 = 1.2
const AVGDL = 12
const TF = 2
const DOCS = [
  { name: "short doc", len: 5 },
  { name: "long doc", len: 30 },
]

export function LengthNorm() {
  const [b, setB] = useState(0.75)

  const factor = (len: number) => (TF * (K1 + 1)) / (TF + K1 * (1 - b + (b * len) / AVGDL))
  const scores = DOCS.map((d) => ({ ...d, score: factor(d.len) }))
  const max = Math.max(...scores.map((s) => s.score))
  const ACCENT = "oklch(0.72 0.15 195)"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">document-length normalization · same term count, different lengths</div>
      <div className="p-4">
        <div className="space-y-3">
          {scores.map((s) => (
            <div key={s.name}>
              <div className="mb-1 flex items-center justify-between font-mono text-[11px]">
                <span className="text-muted-foreground">{s.name} · |D| = {s.len}, avgdl = {AVGDL}, tf = {TF}</span>
                <span className="tabular-nums text-foreground">{s.score.toFixed(3)}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded bg-muted">
                <div className="h-full rounded transition-all duration-200" style={{ width: `${(s.score / max) * 100}%`, background: ACCENT }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>b — length normalization (Lucene default 0.75)</span>
            <span className="tabular-nums text-foreground">{b.toFixed(2)}</span>
          </div>
          <input type="range" min={0} max={1} step={0.05} value={b} onChange={(e) => setB(+e.target.value)} className="w-full accent-foreground" aria-label="b" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {b < 0.05
            ? "At b = 0 length is ignored entirely — both documents score the same despite one being 6× longer."
            : "As b rises, the longer-than-average document is penalized: the same two mentions are diluted across more text, so they're weaker evidence that the document is about the term. At b = 1 the normalization is full; b = 0.75 is the usual compromise."}
        </p>
      </div>
    </figure>
  )
}

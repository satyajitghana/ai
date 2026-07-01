"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

// The interpretability finding that motivates head-wise hybridization: heads in the
// SAME layer, reading the SAME input, do different jobs. Some are retrieval-critical
// — they reach far back to a specific token (the "needle"), which only full attention
// can do faithfully. Others attend locally or diffusely, which linear attention
// approximates fine. HydraHead keeps FA only for the retrieval heads. Cycles through
// heads showing each one's attention over the sequence; degrades to a static list.

const N = 20 // tokens; the query is the last one, the "needle" sits early

type Head = { name: string; kind: string; fa: boolean; weights: number[] }

function build(): Head[] {
  const needle = 3
  const q = N - 1
  const local = Array.from({ length: N }, (_, i) => Math.exp(-((q - i) ** 2) / 6))
  const retrieval = Array.from({ length: N }, (_, i) => (i === needle ? 1 : 0.04 * Math.exp(-((q - i) ** 2) / 40)))
  const induction = Array.from({ length: N }, (_, i) => (i === 11 ? 0.9 : i === 12 ? 0.5 : 0.03))
  const diffuse = Array.from({ length: N }, () => 0.5 + 0.001)
  const norm = (w: number[]) => {
    const s = w.reduce((a, b) => a + b, 0)
    return w.map((x) => x / s)
  }
  return [
    { name: "head 2", kind: "retrieval — reaches back to the needle token", fa: true, weights: norm(retrieval) },
    { name: "head 5", kind: "local — attends to its neighbours", fa: false, weights: norm(local) },
    { name: "head 6", kind: "induction — copies from a matched earlier token", fa: true, weights: norm(induction) },
    { name: "head 9", kind: "diffuse — spreads attention broadly", fa: false, weights: norm(diffuse) },
  ]
}

const HEADS = build()
const NEEDLE = 3

export function RetrievalHeads() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % HEADS.length), 2400)
    return () => clearInterval(id)
  }, [playing])

  const h = HEADS[i]
  const max = Math.max(...h.weights)
  const FA = "oklch(0.72 0.15 25)"
  const LA = "oklch(0.62 0.13 195)"
  const c = h.fa ? FA : LA

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>one layer · heads do different jobs</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        {/* head selector */}
        <div className="flex flex-wrap gap-1.5">
          {HEADS.map((hd, k) => (
            <button
              key={hd.name}
              type="button"
              onClick={() => setI(k)}
              className="cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-all"
              style={
                k === i
                  ? { borderColor: hd.fa ? FA : LA, background: `${hd.fa ? FA : LA}`, color: "var(--background)" }
                  : undefined
              }
            >
              {hd.name}
            </button>
          ))}
        </div>

        {/* attention bars over the token sequence */}
        <div className="mt-4 flex items-end gap-[3px]" style={{ height: 90 }}>
          {h.weights.map((w, t) => (
            <div key={t} className="flex flex-1 flex-col items-center justify-end">
              <div
                className="w-full rounded-t-[2px] transition-all duration-500"
                style={{ height: `${(w / max) * 78}px`, background: c, opacity: t === NEEDLE ? 1 : 0.75 }}
              />
              <div
                className="mt-1 h-1.5 w-full rounded-[1px]"
                style={{ background: t === NEEDLE ? "oklch(0.72 0.16 90)" : t === N - 1 ? "var(--foreground)" : "var(--muted)" }}
                title={t === NEEDLE ? "needle token" : t === N - 1 ? "query" : "token"}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
          <span style={{ color: "oklch(0.72 0.16 90)" }}>↑ needle</span>
          <span>query ↑</span>
        </div>

        {/* verdict */}
        <div className="mt-4 rounded-md border-l-2 px-3 py-2.5" style={{ borderColor: c, background: `${c.replace(")", " / 0.08)")}` }}>
          <div className="font-mono text-xs">
            <span className="text-foreground">{h.name}</span>
            <span className="text-muted-foreground"> · {h.kind}</span>
          </div>
          <div className="mt-1 font-mono text-[11px]" style={{ color: c }}>
            {h.fa ? "→ retrieval-critical: keep FULL attention" : "→ short-range: LINEAR attention is enough"}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Same layer, same input — yet these heads specialize. Only the ones that reach far
          back for a specific token genuinely need full attention; the local and diffuse heads
          lose almost nothing under linear attention. That split is the whole basis for
          hybridizing per head instead of per layer.
        </p>
      </div>
    </figure>
  )
}

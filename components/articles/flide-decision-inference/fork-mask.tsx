"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Flide's flat stream and its attention mask, built the way flide/runtime/pack.py
// builds them (OmniJev/Flide @ 46834ce). A round is laid out as every request's
// state first, then every question:
//
//   [s(1) | s(2) | q(1)_1 | ... | q(1)_n | q(2)_1 | ...]
//
// Every token carries (request j, branch c, position t); branch 0 is the state.
// pack() turns that into two key ranges per query token (key_ranges[T, 4]):
//   state token at position a:     keys [state start, state start + a]
//   question token i of a branch:  keys [state start, state end) and [branch start, branch start + i]
// which is the paper's Equation 3: same request, key in the state or the query's
// own branch, key not later. Question positions restart at P for every branch,
// so each one gets the rotary positions it would get alone.
//
// "Delimiter" shows SGLang's multi-item scoring instead: one extra token at the
// head of every branch, which every question token then reads.

const STATE = "oklch(0.62 0.13 250)"
const STATE2 = "oklch(0.62 0.12 300)"
const BR = ["oklch(0.64 0.15 155)", "oklch(0.70 0.14 75)", "oklch(0.62 0.17 25)", "oklch(0.60 0.13 200)", "oklch(0.62 0.15 340)"]
const DELIM = "oklch(0.58 0.21 25)"
const QLEN = [3, 2, 4, 3, 2]

type Tok = {
  job: number
  branch: number // 0 = state, else question index (1-based, global across the round)
  qi: number // question index inside its request, 1-based; 0 for state
  pos: number
  delim: boolean
}

function build(P: number, n: number, two: boolean, delim: boolean) {
  const jobs = two ? [{ P, n }, { P: 4, n: 2 }] : [{ P, n }]
  const toks: Tok[] = []
  const stateStart: number[] = []
  // every state first
  jobs.forEach((jb, j) => {
    stateStart.push(toks.length)
    for (let t = 0; t < jb.P; t++) toks.push({ job: j, branch: 0, qi: 0, pos: t, delim: false })
  })
  // then every question
  const branchStart: number[] = []
  const reads: number[] = []
  let b = 0
  jobs.forEach((jb, j) => {
    for (let c = 1; c <= jb.n; c++) {
      b += 1
      branchStart[b] = toks.length
      const len = (j === 0 ? QLEN[c - 1] : 2) + (delim ? 1 : 0)
      for (let i = 0; i < len; i++) toks.push({ job: j, branch: b, qi: c, pos: jb.P + i, delim: delim && i === 0 })
      reads.push(toks.length - 1)
    }
  })
  const T = toks.length
  // key ranges, as pack() writes them
  const visible = (qx: number, ky: number) => {
    const q = toks[qx]
    const k = toks[ky]
    if (q.branch === 0) {
      const lo = stateStart[q.job]
      return ky >= lo && ky <= lo + q.pos
    }
    const lo = stateStart[q.job]
    const P0 = jobs[q.job].P
    if (ky >= lo && ky < lo + P0) return true
    const bs = branchStart[q.branch]
    return k.branch === q.branch && ky >= bs && ky <= bs + (q.pos - P0)
  }
  const naive = jobs.reduce((a, jb, j) => {
    let s = 0
    for (let c = 1; c <= jb.n; c++) s += jb.P + (j === 0 ? QLEN[c - 1] : 2) + (delim ? 1 : 0)
    return a + s
  }, 0)
  return { jobs, toks, T, visible, reads, naive, stateStart, branchStart }
}

function colorOf(t: Tok) {
  if (t.delim) return DELIM
  if (t.branch === 0) return t.job === 0 ? STATE : STATE2
  return BR[(t.branch - 1) % BR.length]
}

function nameOf(t: Tok) {
  const r = t.job === 0 ? "" : "′"
  if (t.branch === 0) return `s${r}[${t.pos}]`
  return `${t.delim ? "delim" : "q" + t.qi + r}@${t.pos}`
}

export function ForkMask() {
  const [P, setP] = useState(6)
  const [n, setN] = useState(3)
  const [two, setTwo] = useState(false)
  const [delim, setDelim] = useState(false)
  const [sel, setSel] = useState<number | null>(null)

  const m = build(P, n, two, delim)
  const q = sel !== null && sel < m.T ? sel : m.reads[0]
  const qt = m.toks[q]
  const seen = m.toks.map((_, k) => m.visible(q, k))
  const nSeen = seen.filter(Boolean).length
  const pairs = m.toks.reduce((a, _, i) => a + m.toks.filter((__, k) => m.visible(i, k)).length, 0)

  const size = 16
  const pad = 54
  const W = pad + m.T * size + 8
  const H = pad + m.T * size + 8

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one flat stream: {m.T} tokens · one sequence per question: {m.naive} tokens
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">click a row to pick a query token</span>
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
        <label className="block font-mono text-[11px] text-muted-foreground">
          state tokens P = {P}
          <Range min={3} max={10} step={1} value={P} onChange={(e) => { setP(Number(e.target.value)); setSel(null) }} accent={STATE} className="mt-1 w-full" />
        </label>
        <label className="block font-mono text-[11px] text-muted-foreground">
          questions n = {n}
          <Range min={1} max={5} step={1} value={n} onChange={(e) => { setN(Number(e.target.value)); setSel(null) }} accent={BR[0]} className="mt-1 w-full" />
        </label>
        <div className="flex flex-wrap gap-1.5 sm:col-span-2">
          {[
            { on: two, set: () => { setTwo(!two); setSel(null) }, l: "second request in the round" },
            { on: delim, set: () => { setDelim(!delim); setSel(null) }, l: "delimiter per question (multi-item scoring)" },
          ].map((b) => (
            <button
              key={b.l}
              type="button"
              onClick={b.set}
              aria-pressed={b.on}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                b.on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {b.on ? "✓ " : ""}
              {b.l}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto px-3 pb-2 sm:px-4">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="max-w-full" style={{ height: "auto" }}>
          <title>
            {`Attention mask over a flat stream of ${m.T} tokens. Rows are query tokens, columns are key tokens. Each question token sees its own request's state and the earlier tokens of its own question, never another question or another request. The selected token ${nameOf(qt)} sees ${nSeen} keys.`}
          </title>
          {/* stream strip along the top and the left */}
          {m.toks.map((t, i) => (
            <g key={`h${i}`}>
              <rect x={pad + i * size + 1} y={pad - 14} width={size - 2} height={10} rx={2} fill={colorOf(t)} fillOpacity={0.85} />
              <rect x={pad - 14} y={pad + i * size + 1} width={10} height={size - 2} rx={2} fill={colorOf(t)} fillOpacity={0.85} />
            </g>
          ))}
          <text x={pad} y={pad - 20} fontSize={9} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
            keys → (stream order)
          </text>
          <text x={4} y={pad + 4} fontSize={9} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
            queries
          </text>
          <text x={4} y={pad + 14} fontSize={9} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
            ↓
          </text>
          {/* the mask */}
          {m.toks.map((tq, i) =>
            m.toks.map((tk, k) => {
              const v = m.visible(i, k)
              const row = i === q
              return (
                <rect
                  key={`${i}-${k}`}
                  x={pad + k * size + 1}
                  y={pad + i * size + 1}
                  width={size - 2}
                  height={size - 2}
                  rx={1.5}
                  fill={v ? colorOf(tk.branch === 0 || tk.delim ? tk : tq) : "currentColor"}
                  fillOpacity={v ? (row ? 1 : 0.55) : row ? 0.14 : 0.05}
                  stroke={row ? "currentColor" : "none"}
                  strokeOpacity={0.35}
                  strokeWidth={row ? 0.6 : 0}
                />
              )
            }),
          )}
          {/* clickable rows and read markers */}
          {m.toks.map((t, i) => (
            <g key={`r${i}`}>
              {m.reads.includes(i) && (
                <circle cx={pad + m.T * size + 4} cy={pad + i * size + size / 2} r={2.6} fill={colorOf(t)} />
              )}
              <rect
                x={pad - 16}
                y={pad + i * size}
                width={m.T * size + 24}
                height={size}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={() => setSel(i)}
              >
                <title>{nameOf(t)}</title>
              </rect>
            </g>
          ))}
        </svg>
      </div>

      <div className="space-y-1.5 border-t px-4 py-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
        <div>
          <span className="text-foreground">{nameOf(qt)}</span> (stream index {q}, position {qt.pos}) sees {nSeen} of {m.T} keys:{" "}
          {qt.branch === 0
            ? `its own state up to position ${qt.pos}.`
            : `all ${m.jobs[qt.job].P} tokens of its request's state, then its own question up to itself${delim ? ", delimiter included" : ""}.`}
          {two && qt.job === 0 && qt.branch !== 0 ? " The second request's state sits between them in the stream and is skipped." : ""}
        </div>
        <div>
          visible pairs in the whole mask: {pairs.toLocaleString("en-US")} of {(m.T * m.T).toLocaleString("en-US")} · dots mark the last token of each
          question, the only rows the output head reads
        </div>
        <div>
          Gated DeltaNet layers can&apos;t use this mask: call 1 runs every state and keeps its final S<sub>P</sub>; call 2 runs every question
          from its own request&apos;s S<sub>P</sub>, fetched by index (<code>index_select(0, branch_job)</code>), no copy.
        </div>
        {delim && (
          <div style={{ color: DELIM }}>
            Every question now reads one token its standalone prompt never had, so its hidden states are no longer the ones it would get
            alone. The state is still shared; the input is not the same.
          </div>
        )}
      </div>
    </figure>
  )
}

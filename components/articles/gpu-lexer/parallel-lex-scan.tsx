"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Parallel-prefix lexing of a six-state DFA, end to end. The source is cut
// into chunks; each chunk is summarised as a transition table (start state ->
// end state) by running every start state through it; a Hillis-Steele scan
// composes those tables so each chunk learns the state it really starts in;
// then every chunk re-lexes itself independently. The "assume code" toggle
// shows what goes wrong without the scan. Everything here is exact integer
// table lookups, the same algorithm as the CPU experiment in the article.

const STATES = ["code", "/", "comment", "*", "\"str\"", "'str'"] as const
type St = 0 | 1 | 2 | 3 | 4 | 5
const CODE = 0, SLASH = 1, BLOCK = 2, STAR = 3, DQ = 4, SQ = 5
const K = STATES.length

function step(s: number, ch: string): St {
  switch (s) {
    case CODE:
    case SLASH:
      if (ch === "/") return s === SLASH ? CODE : SLASH
      if (ch === "*" && s === SLASH) return BLOCK
      if (ch === "\"") return DQ
      if (ch === "'") return SQ
      return CODE
    case BLOCK:
      return ch === "*" ? STAR : BLOCK
    case STAR:
      if (ch === "/") return CODE
      return ch === "*" ? STAR : BLOCK
    case DQ:
      return ch === "\"" ? CODE : DQ
    default:
      return ch === "'" ? CODE : SQ
  }
}

// The class a character is painted with: the state it is lexed in, where the
// closing delimiter belongs to the thing it closes.
function label(before: number, after: number): number {
  if (before === CODE || before === SLASH) {
    if (after === BLOCK) return BLOCK
    return after === DQ || after === SQ ? after : CODE
  }
  if (before === STAR && after === CODE) return BLOCK
  if (before === BLOCK || before === STAR) return BLOCK
  return before
}

const COLOURS: Record<number, string> = {
  [CODE]: "text-foreground",
  [BLOCK]: "text-muted-foreground italic",
  [DQ]: "text-emerald-600 dark:text-emerald-400",
  [SQ]: "text-emerald-600 dark:text-emerald-400",
}

const PRESETS = [
  `a = "x/*y" + b; /* "c */ d = '*/';`,
  `s = "it's"; /* don't */ t = 'q"';`,
  `u = 1 /2/ 3; /* a * b */ v = "/*";`,
] as const

type Table = number[] // table[s] = state after the chunk, starting in s

function compose(first: Table, second: Table): Table {
  return first.map((mid) => second[mid])
}

export function ParallelLexScan() {
  const [preset, setPreset] = useState(0)
  const [chunks, setChunks] = useState(4)
  const [naive, setNaive] = useState(false)
  const src = PRESETS[preset]

  const model = useMemo(() => {
    const L = Math.ceil(src.length / chunks)
    const parts = Array.from({ length: chunks }, (_, p) => src.slice(p * L, (p + 1) * L))
    // Phase 1: one table per chunk, all start states at once.
    const tables: Table[] = parts.map((part) =>
      Array.from({ length: K }, (_, s0) => {
        let s = s0
        for (const ch of part) s = step(s, ch)
        return s
      })
    )
    // Phase 2: Hillis-Steele inclusive scan over tables, log2(chunks) rounds.
    const rounds: Table[][] = [tables]
    let cur = tables
    for (let d = 1; d < chunks; d *= 2) {
      cur = cur.map((t, p) => (p >= d ? compose(cur[p - d], t) : t))
      rounds.push(cur)
    }
    const start = parts.map((_, p) => (p === 0 ? CODE : cur[p - 1][CODE]))
    // Phase 3: each chunk re-lexes from its start state (or from code, naively).
    const lex = (begin: number[]) =>
      parts.map((part, p) => {
        let s = begin[p]
        return [...part].map((ch) => {
          const b = s
          s = step(s, ch)
          return label(b, s)
        })
      })
    const truth = lex(start)
    const guess = lex(parts.map(() => CODE))
    const wrong = guess.flat().filter((c, i) => c !== truth.flat()[i]).length
    const live = tables.map((t) => new Set(t).size)
    return { parts, tables, rounds, start, truth, guess, wrong, live }
  }, [src, chunks])

  const shown = naive ? model.guess : model.truth

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>parallel-prefix lexing: chunks → tables → scan → tokens</span>
        <span className="text-muted-foreground/60">6-state DFA · exact</span>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(i)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                preset === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              input {i + 1}
            </button>
          ))}
        </div>

        <label className="block">
          <div className="mb-1 flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
            <span>chunks (one per GPU thread)</span>
            <span className="tabular-nums text-foreground">{chunks}</span>
          </div>
          <Range min={2} max={8} step={1} value={chunks} onChange={(e) => setChunks(Number(e.target.value))} />
        </label>

        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            1 · split the source
          </div>
          <div className="flex flex-wrap gap-1.5">
            {model.parts.map((part, p) => (
              <div key={p} className="rounded-md border px-1.5 py-1 font-mono text-[13px] whitespace-pre">
                {[...part].map((ch, i) => (
                  <span key={i} className={cn(COLOURS[shown[p][i]] ?? "", naive && shown[p][i] !== model.truth[p][i] && "rounded-sm bg-red-500/20")}>
                    {ch}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            2 · each chunk becomes a table: start state → end state
          </div>
          <div className="flex flex-wrap gap-1.5">
            {model.tables.map((t, p) => (
              <div key={p} className="rounded-md border px-2 py-1 font-mono text-[10.5px] leading-snug">
                <div className="mb-0.5 text-muted-foreground">
                  chunk {p + 1} · {model.live[p]} distinct out
                </div>
                {t.map((to, from) => (
                  <div key={from} className={cn("tabular-nums", from === model.start[p] ? "text-foreground" : "text-muted-foreground/70")}>
                    {STATES[from]} → {STATES[to]}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            3 · scan: compose tables in {model.rounds.length - 1} rounds, read off each chunk&apos;s start
          </div>
          <div className="overflow-x-auto">
            <table className="font-mono text-[10.5px]">
              <tbody>
                {model.rounds.map((r, d) => (
                  <tr key={d}>
                    <td className="pr-3 text-muted-foreground">{d === 0 ? "tables" : `round ${d}`}</td>
                    {r.map((t, p) => (
                      <td key={p} className="px-1.5 text-center tabular-nums text-muted-foreground">
                        {d === 0 || p === 0 ? `c${p + 1}` : `c${Math.max(1, p + 2 - 2 ** d)}..${p + 1}`}: {STATES[t[CODE]]}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="pr-3 text-foreground">starts in</td>
                  {model.start.map((s, p) => (
                    <td key={p} className="px-1.5 text-center text-foreground">
                      {STATES[s]}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              4 · every chunk re-lexes from its own start, in parallel
            </span>
            <button
              type="button"
              onClick={() => setNaive((v) => !v)}
              className="cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            >
              {naive ? "use the scanned starts" : "skip the scan (assume code)"}
            </button>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            {naive
              ? `Without the scan, ${model.wrong} of ${src.length} characters are coloured wrong (red).`
              : `With the scan, every character matches a single left-to-right pass.`}
          </p>
        </div>
      </div>
    </figure>
  )
}

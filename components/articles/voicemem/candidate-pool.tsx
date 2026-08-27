"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Why VOICEMEM can search a handful of items instead of ranking the whole
// store, and what that buys — from Section 3.1 and Section 5.4.
//
// The left brain does not rank the full memory M. Eq. (1)-(2) restrict search
// to a candidate pool built from one-hop schema/entity expansion of the
// partial transcript:
//
//   (V_t, S_t) = Match(x<=t, V, S)
//   Z_t = V_t u V_{S_t} u N1_strong(...) u N1_weak(...)
//   C_t^L = union_{z in Z_t} I_z,      R_t^L = MemSearch(q_t, C_t^L; K)
//
// The backend then only has to rank C_t^L, not M — so a small K keeps working
// even as the store keeps growing, because growth in M does not grow C_t^L.
// The four rows below are the real (K, tokens-per-turn, accuracy) numbers
// Section 5.4 states in prose, all on LoCoMo, LLM-judge accuracy:
//
//   VoiceMem, routed      K=5   430 tokens   91.2%   (main result, K=5 default)
//   VoiceMem, w/o routing K=30  1,277 tokens ~91.2%  ("matching 430-token accuracy
//                                                      takes K=30 and 1,277 tokens")
//   EverMemOS (strongest baseline) K=10  1,899 tokens  83.13%
//   Mem0 (its own default retrieval, Table 4 "bare")  6,956 tokens  61.68%
//
// Mem0's 6,956 figure also appears independently in the adapter's model card
// ("Memory tokens per turn: Mem0 6,956") -- same number, two documents.

const ROUTED = "oklch(0.55 0.16 155)"
const UNROUTED = "oklch(0.60 0.15 255)"
const BASELINE = "oklch(0.68 0.13 85)"
const WORST = "oklch(0.58 0.19 27)"

type Row = { id: string; label: string; k: string; tokens: number; acc: number; accLabel: string; c: string; note: string }

const ROWS: Row[] = [
  {
    id: "routed",
    label: "VoiceMem, schema-routed",
    k: "K=5",
    tokens: 430,
    acc: 91.2,
    accLabel: "91.2%",
    c: ROUTED,
    note: "the shipped operating point",
  },
  {
    id: "unrouted",
    label: "VoiceMem, routing disabled",
    k: "K=30",
    tokens: 1277,
    acc: 91.2,
    accLabel: "≈91.2%",
    c: UNROUTED,
    note: "same accuracy, 6x the K, 3x the tokens",
  },
  {
    id: "evermemos",
    label: "EverMemOS (strongest baseline)",
    k: "K=10",
    tokens: 1899,
    acc: 83.13,
    accLabel: "83.13%",
    c: BASELINE,
    note: "VoiceMem already passes this at K=3, 362 tok",
  },
  {
    id: "mem0",
    label: "Mem0, its own default retrieval",
    k: "bare",
    tokens: 6956,
    acc: 61.68,
    accLabel: "61.68%",
    c: WORST,
    note: "16x the tokens of the routed row, still behind",
  },
]

const W = 700
const LABEL_W = 190
const CHART_X = LABEL_W + 14
const CHART_W = 700 - CHART_X - 70
const ROW_H = 40
const TOP = 20

export function CandidatePool() {
  const [sortBy, setSortBy] = useState<"tokens" | "accuracy">("tokens")

  const rows =
    sortBy === "tokens" ? [...ROWS].sort((a, b) => a.tokens - b.tokens) : [...ROWS].sort((a, b) => b.acc - a.acc)

  const maxTokens = Math.max(...ROWS.map((r) => r.tokens))
  const scale = CHART_W / maxTokens
  const H = TOP + rows.length * ROW_H + 16

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">tokens sent to the LLM, per turn — LoCoMo</span>
        <div className="flex gap-1.5">
          {(["tokens", "accuracy"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSortBy(s)}
              aria-pressed={sortBy === s}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sortBy === s
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              sort by {s}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Four bars ranking systems by ${sortBy}, on LoCoMo. Sorted by tokens, spending the fewest to the most: VoiceMem routed at 430 tokens for 91.2% accuracy, VoiceMem with routing disabled at 1,277 tokens for about the same accuracy, EverMemOS at 1,899 tokens for 83.13%, and Mem0's own default retrieval at 6,956 tokens for 61.68% -- more tokens than every other row and the lowest accuracy of the four.`}
            </title>

            {rows.map((row, i) => {
              const y = TOP + i * ROW_H
              const barW = Math.max(2, row.tokens * scale)
              return (
                <g key={row.id}>
                  <text
                    x={LABEL_W}
                    y={y + 13}
                    textAnchor="end"
                    fontSize={8}
                    fill="currentColor"
                    fillOpacity={0.8}
                    fontFamily="ui-monospace, monospace"
                  >
                    {row.label}
                  </text>
                  <text
                    x={LABEL_W}
                    y={y + 24}
                    textAnchor="end"
                    fontSize={7}
                    fill="currentColor"
                    fillOpacity={0.42}
                    fontFamily="ui-monospace, monospace"
                  >
                    {row.k} · {row.note}
                  </text>
                  <rect x={CHART_X} y={y + 2} width={CHART_W} height={20} rx={3} fill="currentColor" fillOpacity={0.05} />
                  <rect x={CHART_X} y={y + 2} width={barW} height={20} rx={3} fill={row.c} fillOpacity={0.82} />
                  <text
                    x={CHART_X + barW + 8}
                    y={y + 16}
                    fontSize={8}
                    fill={row.c}
                    fontFamily="ui-monospace, monospace"
                  >
                    {row.tokens.toLocaleString()} tok
                  </text>
                  <text
                    x={CHART_X + Math.min(barW - 6, 6)}
                    y={y + 16}
                    fontSize={7.5}
                    textAnchor={barW > 60 ? "start" : "end"}
                    fill={barW > 60 ? "white" : row.c}
                    fillOpacity={barW > 60 ? 0.95 : 1}
                    fontFamily="ui-monospace, monospace"
                  >
                    {barW > 44 ? row.accLabel : ""}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Sorted by tokens, the order and the accuracy order agree for the top three rows but not
          the last one: <span style={{ color: WORST }}>Mem0&rsquo;s own retrieval</span>{" "}
          spends the most context of any row here and returns the least accurate answers. That is
          the arithmetic behind the paper&rsquo;s &ldquo;nearly 30 points&rdquo; claim — 91.20 −
          61.68 = 29.52 — and it survives a look at Table 4: it is not a cherry-picked K, Mem0 never
          clears 63% at any budget it was given, per K ∈ {"{"}1, 3, 5, 10, 30, 100, 200{"}"}.
          <br />
          <br />
          The routing/no-routing pair is the more useful comparison for the mechanism itself:{" "}
          <span style={{ color: ROUTED }}>with</span>{" "}the one-hop schema expansion, K=5 and 430
          tokens reach 91.2%. <span style={{ color: UNROUTED }}>Remove it</span>{" "}and the ranker still
          gets there — it just needs six times the candidates and three times the tokens to do it.
          Routing does not raise the ceiling; it lowers the budget needed to reach it.
        </p>
      </div>
    </figure>
  )
}

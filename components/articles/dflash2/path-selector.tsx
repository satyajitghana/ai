"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The selector, on a worked example.
//
// DFlash predicts every position of the block independently and in parallel. Each
// pick is plausible on its own; nothing makes them fit together. The classic
// failure is a stutter — two neighbouring positions independently landing on the
// same word — and verification kills the block right there.
//
// DFlash 2 keeps the top 16 candidates at every position and scores every
// adjacent pair:
//
//   S_t(a, b) = U_t(b) + <A(a) . H(h_t), B(b)>
//
// U_t(b) is DFlash's own logit — how much the drafter liked b on its own. The
// second term asks how well b follows a: A and B give each token a compact
// 256-dimensional embedding, matched under a context gate H(h_t) that decides
// which parts of the match count. A low-rank bilinear attention over adjacent
// candidates, in other words. Every pair at every position is scored in one shot,
// with no extra backbone or LM-head pass; the only sequential work left is a walk
// over precomputed scores.
//
// The numbers below are illustrative, not measured — a small hand-built example
// with four candidates per position instead of sixteen, chosen so the stutter
// failure and its repair are both visible. The Viterbi walk over them is real:
// change the mode and the widget recomputes the path rather than replaying a
// scripted one.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const PREFIX = "Diffusion is good for"
const LAST = "for"

// Per-position candidates with the drafter's own logits U_t(b).
const CANDS: { tok: string; u: number }[][] = [
  [
    { tok: "decoding", u: 2.1 },
    { tok: "speculative", u: 2.05 },
    { tok: "the", u: 1.2 },
    { tok: "a", u: 0.8 },
  ],
  [
    { tok: "decoding", u: 2.0 },
    { tok: "speculative", u: 1.6 },
    { tok: "inference", u: 1.4 },
    { tok: "models", u: 0.9 },
  ],
  [
    { tok: "⟨eos⟩", u: 1.5 },
    { tok: "and", u: 1.4 },
    { tok: "in", u: 1.2 },
    { tok: "tasks", u: 1.0 },
  ],
]

// The pairwise term, keyed "predecessor>candidate". Anything unlisted is 0.
const PAIR: Record<string, number> = {
  "for>speculative": 0.9,
  "for>decoding": 0.2,
  "for>the": 0.35,
  "speculative>decoding": 1.1,
  "speculative>inference": 0.7,
  "speculative>speculative": -1.8,
  "decoding>decoding": -1.6,
  "decoding>speculative": -0.4,
  "decoding>models": 0.1,
  "the>models": 0.6,
  "decoding>⟨eos⟩": 0.5,
  "decoding>and": 0.2,
  "inference>⟨eos⟩": 0.4,
  "models>⟨eos⟩": 0.3,
}

const pair = (a: string, b: string) => PAIR[`${a}>${b}`] ?? 0

// What the target model would actually have produced, so the widget can say how
// much of each draft survives verification.
const TRUTH = ["speculative", "decoding", "⟨eos⟩"]

function topPickPath(): number[] {
  return CANDS.map((col) => col.reduce((best, c, i) => (c.u > col[best].u ? i : best), 0))
}

// Viterbi over S_t(a,b) = U_t(b) + pair(a,b), starting from the last verified
// token. Small enough to do exhaustively, but the recursion is the honest shape.
function bestPath(): number[] {
  const n = CANDS.length
  const score: number[][] = []
  const back: number[][] = []
  for (let t = 0; t < n; t++) {
    score.push(new Array(CANDS[t].length).fill(-Infinity))
    back.push(new Array(CANDS[t].length).fill(0))
    for (let j = 0; j < CANDS[t].length; j++) {
      const b = CANDS[t][j].tok
      if (t === 0) {
        score[t][j] = CANDS[t][j].u + pair(LAST, b)
      } else {
        for (let i = 0; i < CANDS[t - 1].length; i++) {
          const v = score[t - 1][i] + CANDS[t][j].u + pair(CANDS[t - 1][i].tok, b)
          if (v > score[t][j]) {
            score[t][j] = v
            back[t][j] = i
          }
        }
      }
    }
  }
  let j = score[n - 1].reduce((best, v, i) => (v > score[n - 1][best] ? i : best), 0)
  const path = new Array(n).fill(0)
  for (let t = n - 1; t >= 0; t--) {
    path[t] = j
    j = back[t][j]
  }
  return path
}

const accepted = (path: number[]) => {
  let k = 0
  while (k < path.length && CANDS[k][path[k]].tok === TRUTH[k]) k++
  return k
}

export function PathSelector() {
  const [mode, setMode] = useState<"top" | "path">("path")
  const path = mode === "top" ? topPickPath() : bestPath()
  const k = accepted(path)
  const total = k + 1 // the verifier contributes its own token either way

  const W = 720
  const H = 210
  const COLW = 132
  const X0 = 122
  const ROWH = 40
  const Y0 = 34
  const cx = (t: number) => X0 + t * COLW
  const cy = (i: number) => Y0 + i * ROWH

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          S<sub>t</sub>(a, b) = U<sub>t</sub>(b) + ⟨A(a) ⊙ H(h<sub>t</sub>), B(b)⟩
        </span>
        <span className="font-mono text-[10px]" style={{ color: k === 3 ? GOOD : WARM }}>
          {k} of 3 drafted tokens survive · {total} emitted this pass
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["top", "DFlash — each position's top pick"],
              ["path", "DFlash 2 — best path through the candidates"],
            ] as const
          ).map(([kk, label]) => (
            <button
              key={kk}
              type="button"
              onClick={() => setMode(kk)}
              aria-pressed={mode === kk}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === kk
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              A trellis of candidate tokens at three draft positions. Taking each position&rsquo;s top pick
              produces a repeated word that fails verification; scoring adjacent pairs and walking the best path
              produces a coherent continuation that survives.
            </title>

            <text x={8} y={Y0 + 4} fontSize={10} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
              {PREFIX.split(" ").slice(0, -1).join(" ")}
            </text>
            <rect x={8} y={Y0 + 12} width={60} height={22} rx={4} fill={WARM} fillOpacity={0.85} />
            <text x={38} y={Y0 + 27} fontSize={10} fill="#0c0a09" textAnchor="middle" fontFamily="ui-monospace, monospace">
              {LAST}
            </text>
            <text x={8} y={Y0 + 50} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              last verified
            </text>

            {/* all the pairwise edges, faint */}
            {CANDS.map((col, t) =>
              col.map((c, i) => {
                const px = t === 0 ? 68 : cx(t - 1) + 92
                const py = t === 0 ? Y0 + 23 : null
                return t === 0 ? (
                  <line
                    key={`e0-${i}`}
                    x1={px}
                    y1={py as number}
                    x2={cx(0)}
                    y2={cy(i) + 11}
                    stroke="currentColor"
                    strokeOpacity={0.12}
                  />
                ) : (
                  CANDS[t - 1].map((_, j) => (
                    <line
                      key={`e${t}-${i}-${j}`}
                      x1={px}
                      y1={cy(j) + 11}
                      x2={cx(t)}
                      y2={cy(i) + 11}
                      stroke="currentColor"
                      strokeOpacity={0.1}
                    />
                  ))
                )
              }),
            )}

            {/* the chosen path */}
            {path.map((ci, t) => {
              const x1 = t === 0 ? 68 : cx(t - 1) + 92
              const y1 = t === 0 ? Y0 + 23 : cy(path[t - 1]) + 11
              const stutter =
                t > 0 && CANDS[t][ci].tok === CANDS[t - 1][path[t - 1]].tok
              return (
                <line
                  key={`p${t}`}
                  x1={x1}
                  y1={y1}
                  x2={cx(t)}
                  y2={cy(ci) + 11}
                  stroke={stutter ? WARM : t < k ? GOOD : WARM}
                  strokeWidth={2.5}
                />
              )
            })}

            {CANDS.map((col, t) => (
              <g key={t}>
                <text
                  x={cx(t) + 46}
                  y={Y0 - 12}
                  fontSize={9}
                  fill="currentColor"
                  fillOpacity={0.45}
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                >
                  position {t}
                </text>
                {col.map((c, i) => {
                  const on = path[t] === i
                  const ok = on && t < k
                  return (
                    <g key={c.tok}>
                      <rect
                        x={cx(t)}
                        y={cy(i)}
                        width={92}
                        height={22}
                        rx={4}
                        fill={on ? (ok ? GOOD : WARM) : "currentColor"}
                        fillOpacity={on ? 0.85 : 0.07}
                        stroke={on ? "none" : "currentColor"}
                        strokeOpacity={on ? 0 : 0.15}
                      />
                      <text
                        x={cx(t) + 46}
                        y={cy(i) + 15}
                        fontSize={10}
                        fill={on ? "#0c0a09" : "currentColor"}
                        fillOpacity={on ? 1 : 0.6}
                        textAnchor="middle"
                        fontFamily="ui-monospace, monospace"
                      >
                        {c.tok}
                      </text>
                    </g>
                  )
                })}
              </g>
            ))}

            <text x={W - 6} y={H - 6} fontSize={9} fill="currentColor" fillOpacity={0.4} textAnchor="end" fontFamily="ui-monospace, monospace">
              four candidates shown; DFlash 2 keeps sixteen
            </text>
          </svg>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
          {mode === "top" ? (
            <>
              Position 0 and position 1 both independently decide the most likely token is{" "}
              <span className="font-mono text-[11px] text-foreground">decoding</span>. Neither is unreasonable —
              they just never consulted each other. The target model rejects at position 0, the rest of the block
              is discarded, and the pass emits one token.
            </>
          ) : (
            <>
              The pairwise term prices{" "}
              <span className="font-mono text-[11px] text-foreground">decoding → decoding</span>{" "}at −1.6 and{" "}
              <span className="font-mono text-[11px] text-foreground">speculative → decoding</span>{" "}at +1.1, so
              the walk gives up 0.05 of logit at position 0 to buy 2.7 across the pair. The whole block survives
              and the pass emits four tokens.
            </>
          )}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The thing to notice is what the selector does <em>not</em>{" "}do. It never asks the backbone for another
          forward pass, never touches the LM head again, and never rewrites a full-vocabulary distribution. It
          scores adjacent pairs of tokens that were already computed, all of them at once, and then walks the
          result.{" "}
          <span className="text-foreground">All the parallelism survives; only the final walk is sequential</span>,
          and it is a walk over numbers already in registers.
          <br />
          <br />
          That is why it costs two million parameters and 0.6% of cycle latency while beating a sequential
          correction head that costs seventy-eight million and 9.6%. The candidates were always there. Nobody had
          bothered to connect them.
        </p>
      </div>
    </figure>
  )
}

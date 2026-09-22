"use client"

import { useState } from "react"

import { mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Where the relation actually gets built in a swarm.
//
// The decision layer answers each agent's question in isolation — jev-swarm's
// README states the constraint as a design rule: "intentions stay private — no
// question may see another question's answer." So two agents can both be
// confidently right about their own best move and jointly wrong.
//
// The repository's answer is a deterministic Joint Action Resolver: enumerate
// joint actions, drop the ones that violate a hard constraint, and keep the one
// maximising the sum of log probabilities. That is a program, not a model, and
// it is the only place in the system where one agent's preference is compared
// to another's.
//
// The worked case below is the README's own scenario ("two snakes will
// eventually want the same food"), with a made-up but plausible pair of
// distributions. It is an illustration of the rule, not a recorded tick; the
// measured numbers in this article come from the repository's screenshots.
//
// Σ log P is computed through lib/dmath's mlog, because these values reach the
// DOM and Math.log is only an implementation-dependent approximation.

type Move = "left" | "straight" | "right"
const MOVES: Move[] = ["left", "straight", "right"]
const LABEL: Record<Move, string> = { left: "left", straight: "straight", right: "right" }

// P(move) for each agent, as the decision layer returned them, independently.
const P: Record<"s3" | "s7", Record<Move, number>> = {
  s3: { left: 0.08, straight: 0.74, right: 0.18 },
  s7: { left: 0.11, straight: 0.62, right: 0.27 },
}

// The hard constraint: both agents going straight lands on the same cell.
function collides(a: Move, b: Move) {
  return a === "straight" && b === "straight"
}

const JOINT = MOVES.flatMap((a) =>
  MOVES.map((b) => {
    const p = P.s3[a] * P.s7[b]
    return {
      a,
      b,
      p,
      score: mlog(P.s3[a]) + mlog(P.s7[b]),
      legal: !collides(a, b),
    }
  }),
)

const ARGMAX = { a: "straight" as Move, b: "straight" as Move }
const BEST = JOINT.filter((j) => j.legal).reduce((x, y) => (y.score > x.score ? y : x))

export function JointResolver() {
  const [mode, setMode] = useState<"raw" | "joint">("joint")
  const chosen = mode === "raw" ? ARGMAX : { a: BEST.a, b: BEST.b }
  const crashed = mode === "raw"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          two agents, one contested cell, one batched call
        </span>
        <div className="flex gap-1">
          {(
            [
              ["raw", "Jev Raw"],
              ["joint", "Jev Joint"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[10px] transition-colors",
                mode === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent bg-muted/20 text-muted-foreground hover:bg-muted/35",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {(["s3", "s7"] as const).map((id) => (
            <div key={id} className="rounded-lg border bg-muted/15 px-3 py-2.5">
              <div className="font-mono text-[11px] text-foreground">
                {id.toUpperCase()} &middot; one Choice, answered in isolation
              </div>
              <div className="mt-2 space-y-1">
                {MOVES.map((m) => {
                  const picked = (id === "s3" ? chosen.a : chosen.b) === m
                  return (
                    <div key={m} className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                        {LABEL[m]}
                      </span>
                      <div className="h-3 flex-1 rounded-sm bg-muted/40">
                        <div
                          className="h-3 rounded-sm"
                          style={{
                            width: `${P[id][m] * 100}%`,
                            background: picked
                              ? "oklch(0.58 0.15 155)"
                              : "oklch(0.62 0.03 250)",
                            opacity: 0.9,
                          }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                        {(P[id][m] * 100).toFixed(0)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse text-left">
            <thead>
              <tr className="border-b">
                {["S3", "S7", "P(S3)·P(S7)", "Σ log P", "legal"].map((h) => (
                  <th
                    key={h}
                    className="px-2 py-1 font-mono text-[10px] font-normal text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {JOINT.slice()
                .sort((x, y) => y.score - x.score)
                .slice(0, 5)
                .map((j) => {
                  const isChoice = j.a === chosen.a && j.b === chosen.b
                  return (
                    <tr
                      key={`${j.a}-${j.b}`}
                      className={cn("border-b last:border-0", isChoice && "bg-muted/40")}
                    >
                      <td className="px-2 py-1 font-mono text-[11px]">{LABEL[j.a]}</td>
                      <td className="px-2 py-1 font-mono text-[11px]">{LABEL[j.b]}</td>
                      <td className="px-2 py-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {j.p.toFixed(4)}
                      </td>
                      <td className="px-2 py-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {j.score.toFixed(3)}
                      </td>
                      <td className="px-2 py-1 font-mono text-[11px]">
                        {j.legal ? (
                          <span style={{ color: "oklch(0.58 0.15 155)" }}>ok</span>
                        ) : (
                          <span style={{ color: "oklch(0.62 0.19 27)" }}>collision</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        <div
          className="mt-3 rounded-lg border px-3 py-2.5"
          style={{
            borderColor: crashed ? "oklch(0.62 0.19 27 / 0.4)" : "oklch(0.58 0.15 155 / 0.4)",
          }}
        >
          <div
            className="font-mono text-[11px]"
            style={{ color: crashed ? "oklch(0.62 0.19 27)" : "oklch(0.58 0.15 155)" }}
          >
            {crashed
              ? "both agents execute their own top-1 · straight / straight · both die"
              : `resolver executes ${LABEL[BEST.a]} / ${LABEL[BEST.b]} · one agent yields · Σ log P = ${BEST.score.toFixed(3)}`}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">
            {crashed
              ? "Each answer is individually the most probable move for the agent that was asked. Nothing in either distribution knows the other exists, because no question may read another question's answer."
              : "The second-best joint action is the best legal one. Nothing about it was decided by the model: code enumerated the pairs, applied the collision rule, and maximised the sum of log probabilities. That comparison is the relation the decision layer cannot form."}
          </div>
        </div>
      </div>
    </figure>
  )
}

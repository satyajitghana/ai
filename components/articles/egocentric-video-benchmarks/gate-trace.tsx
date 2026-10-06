"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Ego2ActJudge, replayed gate by gate on three real rollouts of one Ego2Act task
// ("The cup contains some milk from the sealed milk box."). Levels, verdicts and
// the gist of each note come from the released judge traces in
// ego2act/ego2act-vidgen (traces/ego2act_judge/traces.jsonl), notes abridged.
// Each subgoal climbs Task gates T1-T3 and Physics gates P1-P4 and stops at the
// first failure; T and P are means of the levels reached; S = sqrt(T x P).

const PASS = "oklch(0.64 0.14 155)"
const FAIL = "oklch(0.62 0.2 25)"
const ACC = "oklch(0.62 0.15 280)"

type V = "y" | "n" | "na" | "-"
type Row = { label: string; gates: V[]; notes: string[] }
type Rollout = { key: string; name: string; rows: Row[] }

const SUB = ["S1 turn cup upright", "S2 open the carton", "S3 pour milk into cup"]

// gates: [T1, T2, T3, P1, P2, P3, P4]; "-" = not reached
const ROLLOUTS: Rollout[] = [
  {
    key: "wan",
    name: "Wan 2.7 · seed 101",
    rows: [
      {
        label: SUB[0],
        gates: ["n", "-", "-", "na", "-", "-", "-"],
        notes: [
          "No attempt to turn the cup upright.",
          "",
          "",
          "Unattempted: no interaction to inspect.",
          "",
          "",
          "",
        ],
      },
      {
        label: SUB[1],
        gates: ["y", "y", "y", "n", "-", "-", "-"],
        notes: [
          "Hand reaches for and grasps the carton.",
          "Carton is unsealed, a spout appears.",
          "Carton ends open.",
          "Straw never used: the carton acquires an open yellow spout between frames.",
          "",
          "",
          "",
        ],
      },
      {
        label: SUB[2],
        gates: ["y", "y", "n", "n", "-", "-", "-"],
        notes: [
          "Carton tilted over the cup.",
          "Milk is poured toward the cup.",
          "Cup was never upright: milk lands on the base of the inverted cup.",
          "Around 8.6 s the inverted cup becomes an upright cup holding milk.",
          "",
          "",
          "",
        ],
      },
    ],
  },
  {
    key: "minimax",
    name: "MiniMax H3 · seed 101",
    rows: [
      {
        label: SUB[0],
        gates: ["y", "y", "y", "y", "y", "y", "y"],
        notes: [
          "Grasps the upside-down cup and turns it.",
          "Turns it upright and sets it down.",
          "Cup rests upright, opening accessible.",
          "Identity and appearance stay consistent.",
          "Hand visibly grasps the cup first.",
          "No physical violation during the turn.",
          "Cup stays stably upright.",
        ],
      },
      {
        label: SUB[1],
        gates: ["n", "-", "-", "na", "-", "-", "-"],
        notes: ["The milk box is never touched.", "", "", "Unattempted: no interaction to inspect.", "", "", ""],
      },
      {
        label: SUB[2],
        gates: ["n", "-", "-", "na", "-", "-", "-"],
        notes: ["No milk is poured from the box.", "", "", "Unattempted: no interaction to inspect.", "", "", ""],
      },
    ],
  },
  {
    key: "seedance",
    name: "Seedance 2.0 · seed 101",
    rows: [
      {
        label: SUB[0],
        gates: ["y", "y", "y", "y", "y", "y", "y"],
        notes: [
          "Grasps the inverted cup.",
          "Turns it upright.",
          "Opening faces up.",
          "Cup keeps its identity.",
          "Hand touches it before it moves.",
          "Natural flip.",
          "Stays upright.",
        ],
      },
      {
        label: SUB[1],
        gates: ["y", "y", "y", "y", "y", "y", "y"],
        notes: [
          "Picks up the straw.",
          "Pierces the carton with it.",
          "Carton is open.",
          "Straw and carton stay consistent.",
          "Hand pushes the straw in.",
          "Plausible insertion.",
          "Straw stays inserted.",
        ],
      },
      {
        label: SUB[2],
        gates: ["y", "y", "y", "y", "y", "y", "y"],
        notes: [
          "Carton tilted over the cup.",
          "Milk pours through the straw.",
          "Milk is in the cup.",
          "No duplication or swap.",
          "Hand lifts and tilts the carton.",
          "Plausible pour.",
          "Milk stays in the cup.",
        ],
      },
    ],
  },
]

const GATES = ["T1", "T2", "T3", "P1", "P2", "P3", "P4"]
const GATE_Q = [
  "T1 intent: did a directed attempt on the right object begin?",
  "T2 process: was the action carried out as a recognisable trajectory?",
  "T3 end state: does the subgoal end in the required state?",
  "P1 continuity: do objects keep identity, count and a traceable path?",
  "P2 causation: does visible contact precede each response?",
  "P3 interaction: is the interaction physically possible while it happens?",
  "P4 persistence: does the result stay put as forces allow?",
]

// level = gates passed before the first failure, within each axis
function level(g: V[], from: number, to: number): number | "na" {
  let n = 0
  for (let i = from; i < to; i++) {
    if (g[i] === "na") return "na"
    if (g[i] !== "y") break
    n++
  }
  return n
}

const W = 760
const LABEL_W = 210
const COL = 66
const GAP = 22
const ROW_H = 46
const TOP = 34
const colX = (i: number) => LABEL_W + i * COL + (i >= 3 ? GAP : 0)
const H = TOP + ROW_H * 3 + 10

export function GateTrace() {
  const [ri, setRi] = useState(0)
  const [stage, setStage] = useState(7)
  const r = ROLLOUTS[ri]

  const tl = r.rows.map((row) => level(row.gates, 0, 3) as number)
  const pl = r.rows.map((row) => (row.gates[0] === "n" ? "na" : level(row.gates, 3, 7)))
  const T = (100 * tl.reduce((a, b) => a + b, 0)) / (3 * tl.length)
  const pScored = pl.filter((x): x is number => x !== "na")
  const P = pScored.length ? (100 * pScored.reduce((a, b) => a + b, 0)) / (4 * pScored.length) : null
  const S = T === 0 ? 0 : P === null ? null : Math.sqrt(T * P)

  const shown = (gi: number) => gi < stage

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>ego2actjudge · gate trace · pour_milk</span>
        <span className="text-muted-foreground/60">released traces</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {ROLLOUTS.map((o, i) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setRi(i)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                i === ri
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {o.name}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`${r.name}: Task levels ${tl.join(", ")}; Physics levels ${pl.join(", ")}.`}
        >
          <text x={colX(0) + (COL * 3) / 2} y={14} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)" className="font-mono">
            Task gates
          </text>
          <text x={colX(3) + COL * 2} y={14} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)" className="font-mono">
            Physics gates
          </text>
          {GATES.map((g, gi) => (
            <text
              key={g}
              x={colX(gi) + COL / 2}
              y={TOP - 6}
              textAnchor="middle"
              fontSize={12}
              fill={gi === stage - 1 ? ACC : "var(--foreground)"}
              fontWeight={gi === stage - 1 ? 700 : 400}
              className="font-mono"
            >
              {g}
            </text>
          ))}
          {r.rows.map((row, ri2) => {
            const y = TOP + ri2 * ROW_H
            return (
              <g key={row.label}>
                <text x={4} y={y + ROW_H / 2 + 4} fontSize={12.5} fill="var(--foreground)" className="font-mono">
                  {row.label}
                </text>
                {row.gates.map((v, gi) => {
                  const x = colX(gi) + 6
                  const vis = shown(gi)
                  const col = v === "y" ? PASS : v === "n" ? FAIL : "var(--muted-foreground)"
                  const glyph = v === "y" ? "✓" : v === "n" ? "✗" : v === "na" ? "n/a" : "–"
                  return (
                    <g key={gi} opacity={vis ? 1 : 0.18}>
                      <rect
                        x={x}
                        y={y + 6}
                        width={COL - 12}
                        height={ROW_H - 12}
                        rx={8}
                        fill="var(--background)"
                        stroke={vis && (v === "y" || v === "n") ? col : "var(--border)"}
                        strokeWidth={1.5}
                      />
                      <text
                        x={x + (COL - 12) / 2}
                        y={y + ROW_H / 2 + 5}
                        textAnchor="middle"
                        fontSize={v === "na" ? 11 : 15}
                        fill={vis ? col : "var(--muted-foreground)"}
                        className="font-mono"
                      >
                        {vis ? glyph : "·"}
                      </text>
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>

        <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span className="w-20 shrink-0">gates shown</span>
          <Range min={0} max={7} step={1} value={stage} onChange={(e) => setStage(Number(e.target.value))} accent={ACC} className="flex-1" />
          <span className="w-10 text-right text-foreground">{stage}/7</span>
        </div>

        <div className="mt-3 grid min-h-[9.5rem] gap-1 rounded-lg border px-3 py-2.5 font-mono text-[11px] leading-5">
          {stage === 0 ? (
            <p className="text-muted-foreground">
              Before it watches the video, the judge plans subgoals from the goal and the start frame. For all three of these rollouts it planned the same three. Drag right to run the gates.
            </p>
          ) : (
            <>
              <p className="text-foreground">{GATE_Q[stage - 1]}</p>
              {r.rows.map((row) => {
                const v = row.gates[stage - 1]
                const note = row.notes[stage - 1]
                return (
                  <p key={row.label} className="text-muted-foreground">
                    <span style={{ color: v === "y" ? PASS : v === "n" ? FAIL : undefined }}>
                      {row.label.slice(0, 2)} {v === "y" ? "yes" : v === "n" ? "no" : v === "na" ? "n/a" : "not reached"}
                    </span>
                    {note ? <span>{" "}· {note}</span> : null}
                  </p>
                )
              })}
            </>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center font-mono">
          <div className="rounded-lg border px-2 py-2">
            <div className="text-[10px] text-muted-foreground">T = mean(t) / 3</div>
            <div className="text-[11px] text-muted-foreground">levels {tl.join(", ")}</div>
            <div className="text-base text-foreground">{T.toFixed(1)}</div>
          </div>
          <div className="rounded-lg border px-2 py-2">
            <div className="text-[10px] text-muted-foreground">P = mean(p) / 4, attempted only</div>
            <div className="text-[11px] text-muted-foreground">levels {pl.map((x) => (x === "na" ? "n/a" : x)).join(", ")}</div>
            <div className="text-base text-foreground">{P === null ? "n/a" : P.toFixed(1)}</div>
          </div>
          <div className="rounded-lg border px-2 py-2" style={{ borderColor: ACC }}>
            <div className="text-[10px] text-muted-foreground">S = √(T · P)</div>
            <div className="text-[11px] text-muted-foreground">final</div>
            <div className="text-base" style={{ color: ACC }}>
              {S === null ? "n/a" : S.toFixed(1)}
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Wan 2.7 attempts all three subgoals and scores 0, because its two attempted interactions both break continuity at P1. MiniMax H3 only turns the cup over, never touches the milk, and scores 57.7: Physics is averaged over attempted subgoals only, so the one clean interaction carries a perfect P.
        </p>
      </div>
    </figure>
  )
}

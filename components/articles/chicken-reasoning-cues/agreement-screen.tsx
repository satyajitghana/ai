"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog2 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// My own re-implementation of the decider's arithmetic in sophicle/cues
// (cues/agree.py: score_cell and decide, commit cd9caab), run on SYNTHETIC answers.
// None of these rollouts came from a model; they are made up to show the rule.
// Per problem: Shannon entropy in bits of the answer distribution over 16
// rollouts, with "no answer" counted as its own symbol. Per opening: the mean over
// problems, plus the share of rollouts with no answer. The no-cue cell is never
// eligible; an opening is dropped if its no-answer share exceeds no-cue's by more
// than the guard (0.10 in the code). Lowest entropy wins; ties break by name.

type Ans = string | null
type Opening = { id: string; label: string; problems: Ans[][] }

const GOLD = ["1251", "12", "7/2"]
const rep = (pairs: [Ans, number][]): Ans[] => pairs.flatMap(([a, k]) => Array<Ans>(k).fill(a))

const OPENINGS: Opening[] = [
  {
    id: "none",
    label: "no cue",
    problems: [
      rep([["1251", 6], ["1002", 5], ["834", 2], [null, 3]]),
      rep([["12", 7], ["10", 4], ["14", 2], [null, 3]]),
      rep([["7/2", 5], ["3", 4], ["4", 3], [null, 4]]),
    ],
  },
  {
    id: "okay",
    label: "A · deliberates",
    problems: [
      rep([["1251", 14], ["1002", 1], [null, 1]]),
      rep([["12", 13], ["10", 2], [null, 1]]),
      rep([["7/2", 11], ["3", 3], [null, 2]]),
    ],
  },
  {
    id: "answer",
    label: "B · answers fast",
    problems: [
      rep([["1002", 10], ["1251", 4], ["834", 2]]),
      rep([["12", 8], ["10", 6], ["14", 2]]),
      rep([["3", 8], ["7/2", 5], ["4", 3]]),
    ],
  },
  {
    id: "silent",
    label: "C · goes quiet",
    problems: [rep([[null, 15], ["1251", 1]]), rep([[null, 16]]), rep([[null, 14], ["3", 2]])],
  },
]

function entropy(rolls: Ans[]) {
  const counts = new Map<string, number>()
  for (const a of rolls) counts.set(a ?? "NONE", (counts.get(a ?? "NONE") ?? 0) + 1)
  let h = 0
  for (const c of counts.values()) {
    const p = c / rolls.length
    h -= p * mlog2(p)
  }
  return h
}

function score(o: Opening) {
  const ents = o.problems.map(entropy)
  const none = o.problems.map((r) => r.filter((a) => a === null).length / r.length)
  const acc = o.problems.map((r, i) => r.filter((a) => a === GOLD[i]).length / r.length)
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  return { ents, entropy: mean(ents), noneShare: mean(none), accuracy: mean(acc) }
}

const SCORES = Object.fromEntries(OPENINGS.map((o) => [o.id, score(o)]))

const PALETTE: Record<string, string> = {
  "1251": "bg-emerald-500",
  "12": "bg-emerald-500",
  "7/2": "bg-emerald-500",
  "1002": "bg-violet-500",
  "10": "bg-violet-500",
  "3": "bg-violet-500",
  "834": "bg-sky-500",
  "14": "bg-sky-500",
  "4": "bg-sky-500",
}

export function AgreementScreen() {
  const [guard, setGuard] = useState(0.1)
  const base = SCORES.none
  const eligible = OPENINGS.filter((o) => o.id !== "none" && SCORES[o.id].noneShare <= base.noneShare + guard + 1e-9)
  const winner = [...eligible].sort((a, b) => SCORES[a.id].entropy - SCORES[b.id].entropy || a.id.localeCompare(b.id))[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">toy screen · 3 problems × 16 rollouts · synthetic answers</span>
        <span className="font-mono text-xs">
          winner: <span className="text-amber-600 dark:text-amber-400">{winner ? winner.label : "none passes"}</span>
        </span>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left font-mono text-[11px]">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 pr-2 font-normal">opening</th>
                <th className="py-1 pr-2 font-normal">answers per problem (16 each)</th>
                <th className="py-1 pr-2 text-right font-normal">entropy</th>
                <th className="py-1 pr-2 text-right font-normal">no answer</th>
                <th className="py-1 text-right font-normal">[accuracy]</th>
              </tr>
            </thead>
            <tbody>
              {OPENINGS.map((o) => {
                const s = SCORES[o.id]
                const ok = o.id !== "none" && eligible.includes(o)
                return (
                  <tr key={o.id} className={cn("border-t align-top", winner?.id === o.id && "bg-amber-500/10")}>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      {o.label}
                      <div className="text-[10px] text-muted-foreground">{o.id === "none" ? "baseline" : ok ? "eligible" : "dropped by guard"}</div>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="space-y-1">
                        {o.problems.map((rolls, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <div className="flex flex-wrap gap-[2px]">
                              {rolls.map((a, j) => (
                                <span
                                  key={j}
                                  title={a ?? "no answer"}
                                  className={cn("inline-block size-2.5 rounded-[2px]", a === null ? "border border-muted-foreground/40 bg-transparent" : PALETTE[a])}
                                />
                              ))}
                            </div>
                            <span className="pl-1 text-[10px] text-muted-foreground tabular-nums">{s.ents[i].toFixed(2)} bits</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{s.entropy.toFixed(3)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{(s.noneShare * 100).toFixed(1)}%</td>
                    <td className="py-2 text-right text-muted-foreground tabular-nums">{(s.accuracy * 100).toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>
            <span className="mr-1 inline-block size-2.5 rounded-[2px] bg-emerald-500 align-middle" />
            correct
          </span>
          <span>
            <span className="mr-1 inline-block size-2.5 rounded-[2px] bg-violet-500 align-middle" />
            <span className="mr-1 inline-block size-2.5 rounded-[2px] bg-sky-500 align-middle" />
            two wrong answers
          </span>
          <span>
            <span className="mr-1 inline-block size-2.5 rounded-[2px] border border-muted-foreground/40 align-middle" />
            no answer (its own symbol)
          </span>
        </div>
        <div>
          <Range
            min={0}
            max={1}
            step={0.05}
            value={guard}
            onChange={(e) => setGuard(Number(e.target.value))}
            aria-label="Silence guard: allowed excess of no-answer share over no cue"
            accent="oklch(0.75 0.15 75)"
          />
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
            guard = {guard.toFixed(2)} · an opening may have at most {((base.noneShare + guard) * 100).toFixed(1)}% no-answer rollouts
            {guard === 0.1 ? " (the code’s default)" : ""}
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The accuracy column is the check the method never sees. Raise the guard past about 0.73 and the opening that
          mostly says nothing wins: sixteen blank answers agree perfectly. With NONE counted as an answer and the guard
          at 0.10, the opening whose answers converge wins, and here it is also the accurate one. Nothing guarantees
          that in general; a model that confidently repeats one wrong answer would score just as well.
        </p>
      </div>
    </figure>
  )
}

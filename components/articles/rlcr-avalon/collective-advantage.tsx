"use client"

import { useState } from "react"

import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// How RLCR turns one group of organisation rollouts into a training signal,
// transcribed from the Avalon-M1 technical report (gr.inc/avalonm1.pdf,
// 23 Oct 2026), Section 2.2:
//
//   Eq. 3   R_i = sum over the N_i agent trajectories, sum over their tokens,
//           of r_{i,k,t}: every agent's reward events, added up, undiscounted.
//   CISPO   group-relative advantage, A_i = (R_i - mean R) / std R, K = 16,
//           zero-variance groups dropped (we show K = 6 to fit a phone).
//   GKPO    A_i = (1/beta) * (exp(beta R_i) / mean_j exp(beta R_j) - 1),
//           beta = 0.2582, for wealth-style environments on log-returns.
//   Every sampled token of every agent in rollout i gets A_i. Prompts, tool
//   results and messages received from other agents carry no loss.
//
// The reward values below are illustrative, not from the report. The
// "per-agent" view is a counterfactual RLCR does NOT use: it is there to show
// what is thrown away by not estimating each agent's contribution.

const ROLES = ["CEO", "Lead", "Tester", "Researcher"] as const
const STEPS = [0, 0.1, 0.2, 0.4] as const
const BETA = 0.2582

const INITIAL: number[][] = [
  [0, 0.4, 0.1, 0],
  [0, 0.2, 0.2, 0.1],
  [0.1, 0, 0, 0],
  [0, 0.4, 0.2, 0.2],
  [0, 0.1, 0, 0.1],
  [0, 0.2, 0.1, 0],
]

const POS = "oklch(0.62 0.14 150)"
const NEG = "oklch(0.6 0.19 27)"

type Mode = "collective" | "per-agent"
type Obj = "group" | "gkpo"

function groupAdv(rs: number[]): number[] | null {
  const n = rs.length
  const mean = rs.reduce((a, b) => a + b, 0) / n
  const v = rs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n
  if (v < 1e-12) return null
  const sd = Math.sqrt(v)
  return rs.map((r) => (r - mean) / sd)
}

function gkpoAdv(rs: number[]): number[] | null {
  const e = rs.map((r) => mexp(BETA * r))
  const m = e.reduce((a, b) => a + b, 0) / e.length
  const out = e.map((x) => (x / m - 1) / BETA)
  if (out.every((a) => Math.abs(a) < 1e-9)) return null
  return out
}

function fmt(x: number, d = 2) {
  const s = x.toFixed(d)
  return x > 0 ? `+${s}` : s === `-${(0).toFixed(d)}` ? (0).toFixed(d) : s
}

function shade(a: number, scale: number) {
  const k = Math.min(1, Math.abs(a) / scale)
  const pct = Math.round(15 + 70 * k)
  return `color-mix(in oklch, ${a >= 0 ? POS : NEG} ${pct}%, transparent)`
}

function pill(on: boolean) {
  return cn(
    "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
    on ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
  )
}

export function CollectiveAdvantage() {
  const [rw, setRw] = useState<number[][]>(INITIAL)
  const [mode, setMode] = useState<Mode>("collective")
  const [obj, setObj] = useState<Obj>("group")

  const R = rw.map((row) => row.reduce((a, b) => a + b, 0))
  const adv = obj === "group" ? groupAdv(R) : gkpoAdv(R)

  // Counterfactual per-agent credit: each agent slot normalised against the
  // same role in the other rollouts. Not part of RLCR.
  const perAgent: (number[] | null)[] = ROLES.map((_, k) => groupAdv(rw.map((row) => row[k])))

  const cycle = (i: number, k: number) =>
    setRw((p) => {
      const next = p.map((row) => row.slice())
      const at = STEPS.findIndex((s) => Math.abs(s - next[i][k]) < 1e-9)
      next[i][k] = STEPS[(at + 1) % STEPS.length]
      return next
    })

  const scale = obj === "group" ? 1.6 : 0.12

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">One group, one advantage per organisation</span>
        <span className="font-mono text-[10px] text-muted-foreground">rules from the report, §2.2 · rewards illustrative</span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-4 py-3">
        <button type="button" aria-pressed={mode === "collective"} className={pill(mode === "collective")} onClick={() => setMode("collective")}>
          collective (RLCR)
        </button>
        <button type="button" aria-pressed={mode === "per-agent"} className={pill(mode === "per-agent")} onClick={() => setMode("per-agent")}>
          per-agent credit (not used)
        </button>
        <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
        <button type="button" aria-pressed={obj === "group"} className={pill(obj === "group")} onClick={() => setObj("group")}>
          group-relative (CISPO)
        </button>
        <button type="button" aria-pressed={obj === "gkpo"} className={pill(obj === "gkpo")} onClick={() => setObj("gkpo")}>
          GKPO, β = 0.2582
        </button>
      </div>

      <div className="overflow-x-auto px-4 py-4">
        <table className="w-full min-w-[30rem] border-separate border-spacing-y-1.5 text-xs">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="pr-2 text-left font-normal">rollout</th>
              {ROLES.map((r) => (
                <th key={r} className="px-1 text-left font-normal">
                  {r}
                </th>
              ))}
              <th className="px-1 text-right font-normal">R</th>
              <th className="pl-1 text-right font-normal">A</th>
            </tr>
          </thead>
          <tbody>
            {rw.map((row, i) => (
              <tr key={i}>
                <td className="pr-2 font-mono text-muted-foreground">org {i + 1}</td>
                {row.map((r, k) => {
                  const a = mode === "collective" ? (adv ? adv[i] : 0) : perAgent[k] ? (perAgent[k] as number[])[i] : 0
                  return (
                    <td key={k} className="px-1">
                      <button
                        type="button"
                        onClick={() => cycle(i, k)}
                        aria-label={`org ${i + 1} ${ROLES[k]} reward ${r.toFixed(1)}, advantage ${fmt(a)}; click to change the reward`}
                        className="flex w-full items-center justify-between gap-1 rounded-md border px-1.5 py-1 font-mono text-[11px]"
                        style={{ background: shade(a, mode === "collective" ? scale : 1.6) }}
                      >
                        <span className="text-muted-foreground">r {r.toFixed(1)}</span>
                        <span>{fmt(a)}</span>
                      </button>
                    </td>
                  )
                })}
                <td className="px-1 text-right font-mono">{R[i].toFixed(1)}</td>
                <td className="pl-1 text-right font-mono">{adv ? fmt(adv[i]) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        {adv === null && mode === "collective" ? (
          <>
            Every organisation earned the same total, so the group has zero variance and is dropped: no token in it is
            trained on.{" "}
          </>
        ) : null}
        {mode === "collective" ? (
          <>
            Each cell is one agent: its own reward events (r) and the advantage its sampled tokens are trained on. In
            RLCR every agent in an organisation gets that organisation&rsquo;s A, so a researcher who earned nothing is
            pushed up when the lead carried the team, and a lead who did well is pushed down when the team lost. Click a
            reward to change it and watch the whole row move.
          </>
        ) : (
          <>
            The counterfactual: each agent scored against the same role in the other organisations. This is the per-agent
            credit RLCR deliberately does not estimate. It would reward the CEO for its own reward events, which are
            usually zero, rather than for the team it built.
          </>
        )}
      </figcaption>
    </figure>
  )
}

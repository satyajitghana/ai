"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// LFM2.5-2.6B, pass@1 on the guide's 1,000 test cells (250 held-out SmolDataEnvs
// tasks x 4 harnesses, one attempt each). Every value is copied from the Space's
// own data files, app/src/content/assets/data/training-results.json (RL, by
// checkpoint) and sft-vs-rl.json (SFT after epoch 2, and the base model). The
// tool-call column is the guide's own metric: 100 x (1 - run calls / base calls)
// over task-harness pairs both the base and the run solved.
//
// The noise band is my arithmetic, not the guide's: one Bernoulli attempt per
// task, 250 tasks per harness, so a 95% half-width of 1.96 x sqrt(0.25/250) =
// 6.2 points per harness and 3.1 points over all 1,000 cells, at p = 0.5.

type Harness = "opencode" | "claude" | "codex" | "mini" | "overall"
const ROWS: { k: Harness; label: string }[] = [
  { k: "opencode", label: "OpenCode" },
  { k: "claude", label: "Claude Code" },
  { k: "codex", label: "Codex" },
  { k: "mini", label: "Mini-SWE-Agent" },
  { k: "overall", label: "all four" },
]

type Run = {
  label: string
  short: string
  trained: string
  pass: Record<Harness, number>
  calls?: Record<Harness, number>
}

const BASE: Run = {
  label: "base model",
  short: "base",
  trained: "nothing yet",
  pass: { opencode: 33.6, claude: 33.2, codex: 40.0, mini: 62.1, overall: 42.2 },
}

type Ckpt = "final" | "best"

const RL: Record<Ckpt, Run[]> = {
  final: [
    {
      label: "RL, OpenCode only (step 1,000)",
      short: "RL · OpenCode",
      trained: "OpenCode",
      pass: { opencode: 58.0, claude: 42.0, codex: 43.2, mini: 66.0, overall: 52.3 },
      calls: { opencode: 36.4, claude: -9.6, codex: 23.6, mini: 2.1, overall: 11.4 },
    },
    {
      label: "RL, four harnesses (step 1,000)",
      short: "RL · multi",
      trained: "all four",
      pass: { opencode: 49.6, claude: 48.8, codex: 53.6, mini: 64.8, overall: 54.2 },
      calls: { opencode: 32.8, claude: 28.3, codex: 53.0, mini: 16.2, overall: 31.1 },
    },
  ],
  best: [
    {
      label: "RL, OpenCode only (step 900)",
      short: "RL · OpenCode",
      trained: "OpenCode",
      pass: { opencode: 56.0, claude: 43.6, codex: 48.4, mini: 61.6, overall: 52.4 },
      calls: { opencode: 34.9, claude: 7.3, codex: 18.2, mini: 3.4, overall: 13.2 },
    },
    {
      label: "RL, four harnesses (step 700)",
      short: "RL · multi",
      trained: "all four",
      pass: { opencode: 51.2, claude: 48.8, codex: 53.6, mini: 64.8, overall: 54.6 },
      calls: { opencode: 31.4, claude: 19.2, codex: 46.8, mini: 14.8, overall: 26.7 },
    },
  ],
}

const SFT: Run[] = [
  {
    label: "SFT, OpenCode rollouts (801)",
    short: "SFT · OpenCode",
    trained: "OpenCode",
    pass: { opencode: 51.6, claude: 33.2, codex: 46.4, mini: 58.8, overall: 47.5 },
    calls: { opencode: 17.1, claude: -10.5, codex: 31.7, mini: -4.8, overall: 8.5 },
  },
  {
    label: "SFT, all rollouts (3,189)",
    short: "SFT · multi",
    trained: "all four",
    pass: { opencode: 38.0, claude: 42.4, codex: 46.8, mini: 45.2, overall: 43.1 },
    calls: { opencode: 18.0, claude: 27.1, codex: 41.8, mini: 10.8, overall: 24.2 },
  },
]

type View = "pass" | "delta" | "calls"

const NOISE: Record<Harness, number> = { opencode: 6.2, claude: 6.2, codex: 6.2, mini: 6.2, overall: 3.1 }

function fmt(v: number, signed: boolean) {
  const s = v.toFixed(1)
  if (!signed) return s
  return v > 0 ? `+${s}` : v < 0 ? s.replace("-", "−") : "0.0"
}

// diverging fill for a change; magnitude capped at 25 points
function deltaFill(d: number) {
  const t = Math.min(1, Math.abs(d) / 25)
  const a = (0.1 + 0.55 * t).toFixed(3)
  return d >= 0 ? `oklch(0.66 0.13 185 / ${a})` : `oklch(0.66 0.16 15 / ${a})`
}
function passFill(v: number) {
  const t = Math.min(1, Math.max(0, (v - 30) / 40))
  return `oklch(0.66 0.1 250 / ${(0.08 + 0.5 * t).toFixed(3)})`
}

export function HarnessGrid() {
  const [view, setView] = useState<View>("delta")
  const [ckpt, setCkpt] = useState<Ckpt>("final")
  const [sft, setSft] = useState(true)

  const runs: Run[] = [BASE, ...RL[ckpt], ...(sft ? SFT : [])]

  const cell = (run: Run, k: Harness) => {
    if (view === "pass") {
      const v = run.pass[k]
      return { text: fmt(v, false), fill: passFill(v), weak: false }
    }
    if (run === BASE) return { text: view === "calls" ? "0.0" : fmt(run.pass[k], false), fill: "transparent", weak: view === "delta" }
    if (view === "delta") {
      const d = run.pass[k] - BASE.pass[k]
      return { text: fmt(d, true), fill: deltaFill(d), weak: Math.abs(d) < NOISE[k] }
    }
    const c = run.calls ? run.calls[k] : 0
    return { text: fmt(c, true), fill: deltaFill(c), weak: false }
  }

  const btn = (on: boolean) =>
    cn(
      "cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">LFM2.5-2.6B: where each training regime moved the score</span>
        <span className="font-mono text-[11px] text-muted-foreground">250 tasks per harness, 1 attempt each</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">show</span>
          <button type="button" className={btn(view === "pass")} aria-pressed={view === "pass"} onClick={() => setView("pass")}>
            pass@1 %
          </button>
          <button type="button" className={btn(view === "delta")} aria-pressed={view === "delta"} onClick={() => setView("delta")}>
            change vs base, points
          </button>
          <button type="button" className={btn(view === "calls")} aria-pressed={view === "calls"} onClick={() => setView("calls")}>
            fewer tool calls, %
          </button>
          <span className="ml-2 font-mono text-[11px] text-muted-foreground">RL checkpoint</span>
          <button type="button" className={btn(ckpt === "final")} aria-pressed={ckpt === "final"} onClick={() => setCkpt("final")}>
            step 1,000
          </button>
          <button type="button" className={btn(ckpt === "best")} aria-pressed={ckpt === "best"} onClick={() => setCkpt("best")}>
            best on test
          </button>
          <label className="ml-2 flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <input type="checkbox" checked={sft} onChange={(e) => setSft(e.target.checked)} />
            SFT rows
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="w-[34%] text-left font-mono text-[11px] font-normal text-muted-foreground">trained in →</th>
                {ROWS.map((r) => (
                  <th key={r.k} className={cn("text-center font-mono text-[11px] font-normal text-muted-foreground", r.k === "overall" && "text-foreground")}>
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.label}>
                  <td className="pr-2 text-[12.5px] leading-tight">
                    <span className="text-foreground">{run.label}</span>
                    <span className="block font-mono text-[10.5px] text-muted-foreground">trained in: {run.trained}</span>
                  </td>
                  {ROWS.map((r) => {
                    const c = cell(run, r.k)
                    const home = run.trained === "OpenCode" && r.k === "opencode"
                    return (
                      <td
                        key={r.k}
                        className={cn(
                          "rounded-md px-1 py-2 text-center font-mono text-[12.5px] tabular-nums",
                          c.weak ? "text-muted-foreground" : "text-foreground",
                          home && "ring-1 ring-foreground/40",
                          r.k === "overall" && "font-semibold"
                        )}
                        style={{ background: c.fill }}
                      >
                        {c.text}
                        {c.weak && run !== BASE ? <span className="ml-0.5 text-[9px]">~</span> : null}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          {view === "delta"
            ? "Points against the base model on the same 250 tasks per harness. A “~” marks a change smaller than one run's binomial noise band (±6.2 points per harness, ±3.1 overall, my arithmetic). The ringed cell is the harness a single-harness run trained in."
            : view === "calls"
              ? "Percent fewer tool calls than the base model, counted only on task-harness pairs both solved. Negative means more calls. RL was rewarded for fewer calls; SFT was not."
              : "Pass@1 per harness, one graded attempt per task. The base model's 62.1 under Mini-SWE-Agent against 33.2 under Claude Code is the same weights."}
        </p>
      </div>
    </figure>
  )
}

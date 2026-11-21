"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { FIRST_REQUEST, HARNESSES, KINDS, RUNS, SUMMARY, TASKS, type Run } from "./data"

// Where each harness's tokens went, request by request, from the metering proxy on the beast2 run.
// Pick a task: every harness's first attempt at it is drawn on one shared scale. Each bar is one
// request to the model: the part llama.cpp served from its prompt cache, the part it had to prefill,
// and what the model wrote back. The line under it is the size of the harness's first agent request
// (median over all 26 runs): system prompt, tool schemas and task, before any history. Nothing here
// is simulated; the numbers are the run's own.
//
// SSR-safe: static data, no randomness, deterministic first render.

const C_CACHE = "oklch(0.72 0.03 250)"
const C_NEW = "oklch(0.66 0.15 45)"
const C_OUT = "oklch(0.6 0.16 150)"

const LABEL: Record<string, string> = { pi: "pi", opencode: "OpenCode", mini: "mini-swe-agent", aider: "Aider" }

function fmt(n: number): string {
  const r = Math.round(n)
  const s = String(Math.abs(r))
  let out = ""
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ","
    out += s[i]
  }
  return (r < 0 ? "-" : "") + out
}

function k(n: number): string {
  return n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n))
}

function firstRun(h: string, task: string): Run | undefined {
  return RUNS.find((r) => r.h === h && r.task === task && r.att === 1) ?? RUNS.find((r) => r.h === h && r.task === task)
}

export function TokenFlow() {
  const [task, setTask] = useState<string>(TASKS.includes("explore") ? "explore" : TASKS[0])
  const runs = HARNESSES.map((h) => ({ h, run: firstRun(h, task) }))
  const maxTok = Math.max(1, ...runs.flatMap(({ run }) => (run?.turns ?? []).map((t) => t[0] + t[2])))
  const maxReq = Math.max(1, ...runs.map(({ run }) => run?.turns.length ?? 0))

  const W = 640
  const H = 92
  const barW = Math.min(22, (W - 8) / maxReq - 2)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>tokens per request, same model, same task · measured</span>
        <span className="flex flex-wrap gap-3">
          <span><i className="mr-1 inline-block size-2.5 rounded-sm align-middle" style={{ background: C_CACHE }} />cached prompt</span>
          <span><i className="mr-1 inline-block size-2.5 rounded-sm align-middle" style={{ background: C_NEW }} />prefilled</span>
          <span><i className="mr-1 inline-block size-2.5 rounded-sm align-middle" style={{ background: C_OUT }} />generated</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-3 py-2.5" role="tablist" aria-label="Task">
        {TASKS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === task}
            onClick={() => setTask(t)}
            className={cn(
              "rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
              t === task ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="px-4 pt-3 font-mono text-[11px] text-muted-foreground">
        task <span className="text-foreground">{task}</span> ({KINDS[task]}) · first attempt · bars share one scale: tallest {fmt(maxTok)} tokens
      </p>

      <div className="space-y-4 p-3 sm:p-4">
        {runs.map(({ h, run }) => {
          const turns = run?.turns ?? []
          const prompt = turns.reduce((a, t) => a + t[0], 0)
          const cached = turns.reduce((a, t) => a + t[1], 0)
          const out = turns.reduce((a, t) => a + t[2], 0)
          const first = FIRST_REQUEST[h]
          return (
            <div key={h}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-xs">
                <span className="font-semibold">{LABEL[h] ?? h}</span>
                <span className="text-muted-foreground">
                  {run ? (
                    <>
                      {turns.length} requests · {fmt(prompt)} prompt ({prompt ? Math.round((cached / prompt) * 100) : 0}% cached) · {fmt(out)} generated ·{" "}
                      {run.wall}s ·{" "}
                      <span className={run.solved ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                        {run.solved ? "solved" : "not solved"}
                      </span>
                    </>
                  ) : (
                    "no run"
                  )}
                </span>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-auto w-full" role="img" aria-label={`${LABEL[h] ?? h}: ${turns.length} requests`}>
                <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="currentColor" strokeOpacity={0.2} />
                {turns.map((t, i) => {
                  const x = 4 + i * (barW + 2)
                  const hc = (t[1] / maxTok) * (H - 4)
                  const hn = ((t[0] - t[1]) / maxTok) * (H - 4)
                  const ho = (t[2] / maxTok) * (H - 4)
                  return (
                    <g key={i}>
                      <title>{`request ${i + 1}: ${fmt(t[0])} prompt (${fmt(t[1])} cached), ${fmt(t[2])} generated`}</title>
                      <rect x={x} y={H - hc} width={barW} height={hc} fill={C_CACHE} />
                      <rect x={x} y={H - hc - hn} width={barW} height={hn} fill={C_NEW} />
                      <rect x={x} y={H - hc - hn - ho} width={barW} height={ho} fill={C_OUT} />
                    </g>
                  )
                })}
              </svg>
              {first ? (
                <p className="font-mono text-[10px] text-muted-foreground">
                  first agent request, median of 26 runs: {fmt(first)} tokens before any history
                </p>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="border-t px-4 py-3">
        <p className="mb-2 font-mono text-[11px] text-muted-foreground">all {TASKS.length} tasks, every attempt</p>
        <div className="grid gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-2">
          {HARNESSES.map((h) => {
            const s = SUMMARY[h]
            return (
              <div key={h} className="flex justify-between gap-2">
                <span>{LABEL[h] ?? h}</span>
                <span className="text-muted-foreground">
                  {s.solved}/{s.runs} solved · median {s.medRequests} requests · {k(s.medPrompt)} prompt · {k(s.medCompletion)} out
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </figure>
  )
}

"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { COST, type CostRow } from "./data"

// Measured cost of /v1/systemone on CPU, from my own runs: llama-server at
// commit d7a695e, Q8_0 GGUFs, 6 threads at nice 19 on a 16-core EPYC 7R13 that
// other jobs were loading to a load average of 120-160. Token counts are exact
// (the server's /metrics counters around each request); milliseconds are the
// median of five requests and are contention-dominated, so read their ratios.
// Every repetition put a fresh number at the start of the state, so nothing was
// reused across requests.

type Model = "kev" | "julia"
type Sweep = "opts" | "qs" | "state"

const MODELS: { id: Model; label: string }[] = [
  { id: "kev", label: "Kev-0.8B (causal, 812 MB)" },
  { id: "julia", label: "Julia-1 (encoder, 168 MB)" },
]

const SWEEPS: { id: Sweep; label: string; unit: string; setup: string }[] = [
  {
    id: "opts",
    label: "options",
    unit: "options",
    setup: "one choice question, a two-sentence state",
  },
  {
    id: "qs",
    label: "questions",
    unit: "questions",
    setup: "a 24-sentence state, each question a 4-option choice, 4 slots",
  },
  {
    id: "state",
    label: "state length",
    unit: "sentences",
    setup: "one 4-option choice question, the state grows",
  },
]

function Rows({ rows, maxTok, maxMs, note }: { rows: CostRow[]; maxTok: number; maxMs: number; note?: string }) {
  return (
    <div className="grid gap-1.5">
      {note ? (
        <p className="m-0 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">{note}</p>
      ) : null}
      {rows.map((r) => (
        <div
          key={`${note ?? ""}-${r.x}`}
          className="grid grid-cols-[2.5rem_1fr_4.5rem] items-center gap-2 font-mono text-[10px]"
        >
          <span className="text-right text-muted-foreground">{r.x}</span>
          {r.error ? (
            <span className="rounded-sm border border-red-500/50 bg-red-500/10 px-1.5 py-0.5 text-red-700 dark:text-red-300">
              refused: {r.error}
            </span>
          ) : (
            <div className="relative flex h-4 overflow-hidden rounded-sm bg-muted">
              <div
                className="h-full bg-sky-600/80"
                style={{ width: `${(((r.processed ?? 0) / maxTok) * 100).toFixed(2)}%` }}
                title={`${r.processed} tokens evaluated`}
              />
              <div
                className="h-full bg-emerald-500/40"
                style={{ width: `${(((r.cached ?? 0) / maxTok) * 100).toFixed(2)}%` }}
                title={`${r.cached} tokens copied from the shared prefix`}
              />
              <span className="absolute inset-y-0 left-1 flex items-center font-semibold">
                {r.processed}
                {r.cached ? ` + ${r.cached} shared` : ""}
              </span>
            </div>
          )}
          <span className="text-right">
            {r.ms !== undefined ? (
              <>
                <span
                  className="mr-1 inline-block h-1.5 rounded-full bg-amber-500 align-middle"
                  style={{ width: `${Math.max(2, Math.round((r.ms / maxMs) * 28))}px` }}
                />
                {r.ms >= 1000 ? `${(r.ms / 1000).toFixed(1)} s` : `${Math.round(r.ms)} ms`}
              </>
            ) : (
              "—"
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

export function CostExplorer() {
  const [model, setModel] = useState<Model>("kev")
  const [sweep, setSweep] = useState<Sweep>("qs")

  const groups: { note?: string; rows: CostRow[] }[] = []
  const m = COST[model]
  if (sweep === "qs" && model === "kev") {
    groups.push({ note: "4 slots: one parent, the others copy its prefix", rows: m.qs })
    groups.push({ note: "1 slot: nothing to copy to", rows: m.qs1 })
  } else if (sweep === "state" && model === "julia") {
    groups.push({ note: "default --ubatch-size 512", rows: m.state })
    groups.push({ note: "--ubatch-size 2048", rows: m.stateUb })
  } else {
    groups.push({ rows: m[sweep] })
  }

  const all = groups.flatMap((g) => g.rows).filter((r) => !r.error)
  const maxTok = Math.max(...all.map((r) => (r.processed ?? 0) + (r.cached ?? 0)), 1)
  const maxMs = Math.max(...all.map((r) => r.ms ?? 0), 1)
  const sw = SWEEPS.find((s) => s.id === sweep)!

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        measured: tokens evaluated and time per request, llama-server on CPU
      </div>

      <div className="grid gap-2 border-b p-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Model">
          {MODELS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setModel(x.id)}
              aria-pressed={model === x.id}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                model === x.id ? "bg-foreground text-background" : "hover:bg-muted"
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="What grows">
          {SWEEPS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSweep(x.id)}
              aria-pressed={sweep === x.id}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                sweep === x.id ? "bg-sky-600 text-white" : "hover:bg-muted"
              )}
            >
              grow the {x.label}
            </button>
          ))}
        </div>
        <p className="m-0 font-mono text-[10px] text-muted-foreground">
          {sw.setup} · left column: {sw.unit} · bar: tokens evaluated (blue) and copied from the shared
          prefix (green) · right: median of 5 requests
        </p>
      </div>

      <div className="grid gap-4 p-3">
        {groups.map((g) => (
          <Rows key={g.note ?? "only"} rows={g.rows} maxTok={maxTok} maxMs={maxMs} note={g.note} />
        ))}
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        Time tracks evaluated tokens, about 7.8 ms each for Kev-0.8B and 0.89 ms for Julia-1 on this
        loaded machine. Options cost tokens, not passes. An extra question costs Kev only its own
        tokens while a free slot can take a copy of the state; past that the state is read again.
        Julia re-reads the state for every question.
      </figcaption>
    </figure>
  )
}

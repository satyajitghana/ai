"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One orchestrator turn: a batch of thread calls that implicitly defines a DAG.
//
// The call shape is from the blog and matches crates/nac-core: name, action,
// threads (optional sources), skills (optional), timeout (optional). A source
// dispatched in the SAME batch becomes a dependency edge; a source that already
// completed just supplies its latest retained episode as context.
//
// The failure semantics below are from the Rust rather than the prose. The blog
// says nac "rejects the batch"; crates/nac-core/src/agent/tool_exec.rs is more
// precise — on DagError::Cycle or DagError::DuplicateName it calls
// execute_with_dag_error, which returns an error ToolResult for every thread
// dispatch while still executing the non-thread tool calls in that same turn.

type Call = {
  name: string
  action: string
  sources: string[]
  note: string
}

const BATCH: Call[] = [
  { name: "explore-api", action: "map the request path from router to handler", sources: [], note: "No sources, so it starts immediately. Its worker gets a fresh process and context, does whatever reading it needs, and returns one episode." },
  { name: "explore-db", action: "find every query on the hot table", sources: [], note: "Independent of explore-api, so the two run concurrently. This is the parallelism the DAG buys." },
  { name: "setup-env", action: "get the profiler running against a local instance", sources: [], note: "Also independent. Three workers in flight, three separate contexts, none of them polluting the orchestrator's." },
  { name: "profile", action: "profile the hot path and report the top three costs", sources: ["explore-api", "explore-db", "setup-env"], note: "Three same-batch sources, so this is a dependency edge three times over: it waits for all three, then receives their episodes as context. Their execution transcripts are already gone." },
]

const ACCENT = "oklch(0.60 0.15 255)"
const WAIT = "oklch(0.68 0.13 85)"
const BAD = "oklch(0.58 0.19 25)"

type Mode = "ok" | "cycle" | "fail"

export function DispatchDag() {
  const [mode, setMode] = useState<Mode>("ok")
  const [sel, setSel] = useState(3)
  const c = BATCH[sel]

  const status = (i: number) => {
    if (mode === "cycle") return "error"
    if (mode === "fail") {
      if (i === 1) return "error"
      if (i === 3) return "skipped"
    }
    return BATCH[i].sources.length ? "waits" : "runs"
  }

  const COLOR: Record<string, string> = {
    runs: ACCENT, waits: WAIT, error: BAD, skipped: "oklch(0.62 0.03 250)",
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one dispatch batch = one DAG</span>
        <div className="flex flex-wrap gap-1">
          {([["ok", "valid batch"], ["fail", "a worker fails"], ["cycle", "cyclic batch"]] as const).map(([m, l]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === m
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1.5">
          {BATCH.map((x, i) => {
            const st = status(i)
            return (
              <button
                key={x.name}
                type="button"
                onClick={() => setSel(i)}
                aria-pressed={i === sel}
                className={cn(
                  "w-full cursor-pointer rounded-lg border px-2.5 py-2 text-left transition-colors",
                  i === sel ? "border-foreground/30 bg-muted/40" : "bg-muted/15 hover:border-foreground/20",
                )}
                style={{ marginLeft: x.sources.length ? "1.25rem" : 0, width: x.sources.length ? "calc(100% - 1.25rem)" : "100%" }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COLOR[st] }} />
                    <span className="font-mono text-[11px] text-foreground">{x.name}</span>
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: COLOR[st] }}>
                    {st}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{x.action}</div>
                {x.sources.length ? (
                  <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                    threads: {x.sources.join(", ")}
                  </div>
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          {mode === "cycle" ? (
            <div className="text-sm leading-6 text-muted-foreground">
              <span className="font-mono text-[11px]" style={{ color: BAD }}>
                DagError::Cycle
              </span>
              <br />
              Every thread call in the batch gets an error result — but the non-thread tool calls the orchestrator
              made in the same turn still execute. The blog says nac &ldquo;rejects the batch&rdquo;; the Rust is
              narrower than that, and the distinction matters if your orchestrator mixes a query with a dispatch.
            </div>
          ) : mode === "fail" ? (
            <div className="text-sm leading-6 text-muted-foreground">
              <span className="font-mono text-[11px]" style={{ color: BAD }}>
                explore-db fails → profile is skipped
              </span>
              <br />
              Errors from failed threads go back to the orchestrator alongside the successful episodes, and any
              dependent call whose same-batch source failed is skipped. The uncomfortable part is stated plainly in
              the blog: worker failures are{" "}
              <span className="text-foreground">not transactional</span>. A worker that changed the environment and
              then died leaves those changes behind with no episode recording them — so the environment can be
              ahead of the persistent history.
            </div>
          ) : (
            <div className="text-sm leading-6 text-muted-foreground">
              <span className="font-mono text-[11px]" style={{ color: ACCENT }}>
                {c.name}
              </span>
              <br />
              {c.note}
            </div>
          )}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The orchestrator ends its turn by emitting a batch of these, and the batch is the unit of scheduling: nac
          builds the graph, rejects it if it is cyclic or names a target twice, runs what can run in parallel, and
          only returns control once everything has settled. That gives planning a clean synchronization point — the
          orchestrator never polls background work, and never sees a half-finished world.
        </p>
      </div>
    </figure>
  )
}

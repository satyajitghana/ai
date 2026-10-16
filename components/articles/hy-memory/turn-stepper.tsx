"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { STEPS, type NodeState } from "./data"

// A step-through of two turns going through the real Hy Memory engine in
// "pro" mode, replayed from my own run (see data.ts for what was real and
// what was a stub). Each step shows what the engine did, the model call it
// made if any, and the memory store afterwards.

const STAGES = ["write", "extract", "candidates", "reconcile", "store", "recall"] as const

const STATE_STYLE: Record<NodeState, string> = {
  new: "border-emerald-600/60 bg-emerald-500/10",
  active: "border-border bg-background",
  superseded: "border-amber-600/60 bg-amber-500/10 text-muted-foreground line-through decoration-amber-600/60",
  shadow: "border-dashed border-border bg-muted/40 text-muted-foreground",
}

const STATE_LABEL: Record<NodeState, string> = {
  new: "written now",
  active: "active",
  superseded: "superseded",
  shadow: "shadow (not recalled)",
}

export function TurnStepper() {
  const [i, setI] = useState(0)
  const s = STEPS[i]
  const spent = STEPS.slice(0, i + 1).reduce(
    (a, x) => (x.llm ? { calls: a.calls + 1, tin: a.tin + x.llm.promptTokens, tout: a.tout + x.llm.replyTokens } : a),
    { calls: 0, tin: 0, tout: 0 }
  )

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        replayed from a run of the real engine (hy-memory 2.0.1, pro mode) against a localhost stub model
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <button
          type="button"
          onClick={() => setI((x) => Math.max(0, x - 1))}
          disabled={i === 0}
          className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← back
        </button>
        <button
          type="button"
          onClick={() => setI((x) => Math.min(STEPS.length - 1, x + 1))}
          disabled={i === STEPS.length - 1}
          className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          next →
        </button>
        <span className="font-mono text-[11px] text-muted-foreground">
          step {i + 1} of {STEPS.length} · turn {s.turn}
        </span>
      </div>

      <div className="flex flex-wrap gap-1 border-b px-3 py-2" aria-label="Stage">
        {STAGES.map((st) => (
          <span
            key={st}
            className={cn(
              "rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
              st === s.stage ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
            )}
          >
            {st}
          </span>
        ))}
      </div>

      <div className="grid gap-3 p-3 md:grid-cols-2">
        <div className="grid content-start gap-2">
          <p className="m-0 text-sm font-semibold">{s.title}</p>
          <p className="m-0 text-sm text-muted-foreground">{s.body}</p>
          {s.llm ? (
            <p className="m-0 font-mono text-[11px]">
              model call: <strong>{s.llm.promptTokens.toLocaleString("en-US")}</strong> tokens in,{" "}
              <strong>{s.llm.replyTokens}</strong> out
            </p>
          ) : (
            <p className="m-0 font-mono text-[11px] text-muted-foreground">no model call at this step</p>
          )}
          {s.payload ? (
            <div className="grid gap-1 rounded-sm bg-muted/60 p-2">
              {s.payload.map((p, k) => (
                <code key={k} className="block whitespace-pre-wrap break-words font-mono text-[10.5px] leading-snug">
                  {p}
                </code>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid content-start gap-1.5">
          <p className="m-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">memory store after this step</p>
          {s.store.map((r) => (
            <div key={r.id} className={cn("rounded-sm border px-2 py-1 text-[12px] leading-snug", STATE_STYLE[r.state])}>
              <span>{r.text}</span>
              <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground no-underline">
                {STATE_LABEL[r.state]}
                {r.note ? ` · ${r.note}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        running total: {spent.calls} model {spent.calls === 1 ? "call" : "calls"}, {spent.tin.toLocaleString("en-US")} tokens in,{" "}
        {spent.tout} out. Token counts are measured with the Hy-Memory-30B-A3B tokenizer; the decisions shown are my stub&apos;s,
        the plumbing around them is the engine&apos;s.
      </figcaption>
    </figure>
  )
}

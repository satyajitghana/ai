"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// A faithful reconstruction of the six checks in
// packages/core/agent-loop/src/invariant.ts at 47f9438.
//
// The real listener runs on `llm/stream` with { global: true, prepend: true }
// for every request the loop built (isAgentLoopRequest), and fails on:
//
//   1. !Object.isFrozen(options)
//   2. options.sessionId === undefined  (and the session must be live)
//   3. !Object.isFrozen(options.messages)
//   4. no step/start event in the session log
//   5. JSON.stringify(options.messages) !== JSON.stringify(session.deriveMessages())
//   6. model/system/temperature/maxTokens/stop/tools !== the folded request header
//
// Toggling a violation below reproduces the message the real reporter throws,
// prefixed by the owning package, which is how InvariantError attributes it.

type Violation = {
  id: string
  label: string
  message: string
  detail: string
}

const VIOLATIONS: Violation[] = [
  {
    id: "inject",
    label: "smuggle one unlogged message",
    message:
      'llm request for session "s-4f1" diverges from the dispatch-time durable derivation (log-reconstruction desync)',
    detail:
      "The most interesting failure. A plugin appends a message to the outgoing request without writing a session event for it. Nothing crashes, the model behaves better, and the session is now unreproducible — the log no longer explains the answer. This check is the reason that cannot ship.",
  },
  {
    id: "temp",
    label: "change temperature after the header",
    message: 'llm request for session "s-4f1" diverges from the folded request header',
    detail:
      "The header folded out of the log records the model, system prompt, temperature, max tokens, stop sequences and tool schemas the step committed to. Sampling settings are part of what makes a run reproducible, so quietly retuning one between the header and the call is a divergence, not a tweak.",
  },
  {
    id: "freeze",
    label: "leave the request mutable",
    message: "a loop-built request must be frozen",
    detail:
      "Freezing is what makes the other checks meaningful: an unfrozen request could be mutated by a later listener after the comparison passed, so the check would be verifying a value nobody sends.",
  },
  {
    id: "session",
    label: "drop the session id",
    message: 'a loop-built request must carry a live session id, got "undefined"',
    detail:
      "Without a live session there is nothing to derive from and nothing to compare against, so a missing id is not a lenient case — it is the check being unable to run, which is treated as failure rather than a pass.",
  },
  {
    id: "step",
    label: "request before step/start",
    message: "a loop-built request with no step/start in its session log",
    detail:
      "Ordering, made explicit. The durable record of the step has to exist before the request the step makes, otherwise a crash mid-flight leaves a model call that no logged step accounts for.",
  },
]

const OK = "oklch(0.60 0.15 255)"
const BAD = "oklch(0.58 0.19 25)"

export function LogInvariant() {
  const [active, setActive] = useState<string | null>("inject")

  const v = VIOLATIONS.find((x) => x.id === active) ?? null

  // The two sides the invariant compares. When a violation is active the left
  // side gains the row the log never received.
  const derived = ["user/message  →  \"add a retry to the fetch\"", "assistant/message  →  tool_call: str_replace_editor", "tool/result  →  ok, 1 file changed"]
  const sent = active === "inject" ? [...derived, "⚠ (unlogged) \"the user prefers async/await\""] : derived

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          agent-loop invariant · on every llm/stream
        </span>
        <span className="font-mono text-[10px]" style={{ color: v ? BAD : OK }}>
          {v ? "INVARIANT" : "passes"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground">
              options.messages — what is being sent
            </div>
            <div className="mt-1.5 space-y-1">
              {sent.map((r, i) => (
                <div
                  key={r}
                  className="truncate rounded-sm px-1.5 py-1 font-mono text-[10px]"
                  style={{
                    background: i >= derived.length ? "color-mix(in oklch, var(--background), oklch(0.58 0.19 25) 18%)" : "var(--muted)",
                    color: i >= derived.length ? BAD : "var(--muted-foreground)",
                  }}
                >
                  {r}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground">
              session.deriveMessages() — what the log rebuilds
            </div>
            <div className="mt-1.5 space-y-1">
              {derived.map((r) => (
                <div
                  key={r}
                  className="truncate rounded-sm bg-muted px-1.5 py-1 font-mono text-[10px] text-muted-foreground"
                >
                  {r}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-2 rounded-lg border px-3 py-2" style={{ borderColor: v ? BAD : undefined }}>
          <div className="font-mono text-[11px]" style={{ color: v ? BAD : OK }}>
            {v
              ? `InvariantError [@deepseek-ai/dsh-agent-loop]: ${v.message}`
              : "JSON.stringify(options.messages) === JSON.stringify(session.deriveMessages())"}
          </div>
          {v ? <div className="mt-1 text-sm leading-6 text-muted-foreground">{v.detail}</div> : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActive(null)}
            aria-pressed={active === null}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              active === null ? "border-transparent text-white" : "border-border text-muted-foreground",
            )}
            style={active === null ? { background: OK } : undefined}
          >
            valid request
          </button>
          {VIOLATIONS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setActive(x.id)}
              aria-pressed={active === x.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                active === x.id ? "border-transparent text-white" : "border-border text-muted-foreground",
              )}
              style={active === x.id ? { background: BAD } : undefined}
            >
              {x.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Most harnesses treat the transcript as a rendering of the conversation. This one inverts that: the log is
          the source, the request is derived from it, and a runtime check refuses to send anything that does not
          match a fresh derivation, byte for byte through{" "}
          <span className="font-mono text-foreground">JSON.stringify</span>. The practical consequence is that
          &ldquo;why did it do that?&rdquo; always has an answer, because a context the log cannot rebuild is a
          crash rather than a mystery. The listener registers with{" "}
          <span className="font-mono text-foreground">prepend: true</span>{" "}so that a replay or mock listener which
          short-circuits the waterfall still cannot get in front of it.
        </p>
      </div>
    </figure>
  )
}

"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The push gate's whole decision, as checkPush in
// packages/core/src/push-gate.ts makes it. The Claude Code and Codex
// PreToolUse hook and the optional git pre-push hook both call it; neither
// scans or reviews anything. The record it reads is the receipt `review`
// writes into ~/.openqodex (never the repo's .openqodex/, which a branch can
// carry), keyed by the change id. It can abstain or deny; it never allows,
// because an allow would skip the developer's own permission prompt.

type Receipt = "none" | "earlier" | "passed" | "blocked" | "incomplete"

const RECEIPTS: { id: Receipt; label: string }[] = [
  { id: "none", label: "no review on record" },
  { id: "earlier", label: "a review of an earlier version" },
  { id: "passed", label: "this change: complete, passed" },
  { id: "blocked", label: "this change: complete, findings at the threshold" },
  { id: "incomplete", label: "this change: review incomplete" },
]

function decide(r: Receipt, threshold: boolean): { decision: "abstain" | "deny"; message: string } {
  if (r === "incomplete") {
    return { decision: "abstain", message: "OpenQodex: the last review of this change was incomplete, so it does not block. To finish it, run openqodex review." }
  }
  if (r === "none" || r === "earlier") {
    const what = `OpenQodex has not reviewed this change${r === "earlier" ? " (the last review was of an earlier version)" : ""}`
    return threshold
      ? { decision: "deny", message: `${what}, and this repo blocks a push without a passing review. Run openqodex review, then push again.` }
      : { decision: "abstain", message: `${what}. Run openqodex review before pushing.` }
  }
  if (r === "blocked" && threshold) {
    return { decision: "deny", message: "OpenQodex blocks this push: the review of this change found findings at or above the threshold. Fix them, run openqodex review again, then push." }
  }
  // With no threshold a "blocked" verdict cannot exist: everything passes with warnings.
  return { decision: "abstain", message: "(silent)" }
}

export function PushGate() {
  const [r, setR] = useState<Receipt>("none")
  const [threshold, setThreshold] = useState(false)
  const rr = !threshold && r === "blocked" ? "passed" : r
  const d = decide(rr, threshold)
  const deny = d.decision === "deny"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">git push, as the gate sees it</span>
        <span className="font-mono text-[10px] text-muted-foreground">checkPush, push-gate.ts</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="space-y-1">
          {RECEIPTS.map((x) => {
            const off = !threshold && x.id === "blocked"
            return (
              <button
                key={x.id}
                type="button"
                disabled={off}
                onClick={() => setR(x.id)}
                aria-pressed={r === x.id}
                className={cn(
                  "block w-full cursor-pointer rounded-md border px-2 py-1.5 text-left font-mono text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  r === x.id ? "border-foreground/30 bg-muted/40 text-foreground" : "border-transparent text-muted-foreground hover:bg-muted/20",
                )}
              >
                {x.label}
                {off ? " (needs a threshold)" : ""}
              </button>
            )
          })}
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={threshold} onChange={(e) => setThreshold(e.target.checked)} />
          the repo sets <code>review.block_on_severity</code> (off by default)
        </label>
        <div className="mt-3 rounded-lg border px-3 py-2.5" style={{ borderColor: deny ? "oklch(0.58 0.19 25)" : undefined }}>
          <div className="font-mono text-[11px]" style={{ color: deny ? "oklch(0.58 0.19 25)" : "oklch(0.55 0.16 155)" }}>
            {deny ? "deny: the push stops" : "abstain: the push goes on to the usual permission check"}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{d.message}</div>
        </div>
      </div>
    </figure>
  )
}

"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// ticketStage() from src/core/stage.ts, rebuilt from reading. docs/003 says "the first matching row wins"; the
// code is a chain of early returns in exactly that order, so the order of ROWS below is the whole algorithm.

type Report = "none" | "progress" | "waiting" | "ready" | "blocked" | "failed"
type Assignment = "none" | "pending" | "running" | "ended"

interface T {
  ended: boolean
  delivery: boolean
  attention: boolean
  assignment: Assignment
  report: Report
  humanSince: boolean
}

const ROWS: { id: string; stage: string; label: string; test: (t: T) => boolean; who: "person" | "agent" | "none" }[] = [
  { id: "ended", stage: "ended", label: "Ended", test: (t) => t.ended, who: "none" },
  { id: "delivery", stage: "person / delivery", label: "Input undelivered", test: (t) => t.delivery, who: "person" },
  { id: "answer", stage: "person / answer", label: "Awaiting answer", test: (t) => t.attention, who: "person" },
  { id: "review", stage: "person / review", label: "Awaiting review", test: (t) => t.report === "ready", who: "person" },
  { id: "blocked", stage: "person / blocked, failed", label: "Blocked · Failed", test: (t) => (t.report === "blocked" || t.report === "failed") && !t.humanSince, who: "person" },
  { id: "queued", stage: "working / queued", label: "Queued", test: (t) => t.assignment === "none" || t.assignment === "pending", who: "agent" },
  { id: "idle", stage: "idle", label: "Waiting for a Trigger", test: (t) => t.report === "waiting" || t.assignment === "ended", who: "agent" },
  { id: "working", stage: "working", label: "Working", test: () => true, who: "agent" },
]

export function stageOf(t: T): string {
  return ROWS.find((r) => r.test(t))!.id
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => set(!on)}
      className={cn("rounded-md border px-2.5 py-1 font-mono text-xs transition-colors", on ? "border-foreground bg-foreground text-background" : "hover:bg-muted/60")}
    >
      {label}
    </button>
  )
}

export function StageLadder() {
  const [t, setT] = useState<T>({ ended: false, delivery: false, attention: false, assignment: "running", report: "ready", humanSince: false })
  const hit = stageOf(t)
  const patch = (p: Partial<T>) => setT({ ...t, ...p })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">ticket stage · first matching row wins · re-implemented from src/core/stage.ts</div>
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.2fr]">
        <div className="grid content-start gap-3">
          <div className="flex flex-wrap gap-1">
            <Toggle label="ticket ended" on={t.ended} set={(v) => patch({ ended: v })} />
            <Toggle label="input delivery failed" on={t.delivery} set={(v) => patch({ delivery: v })} />
            <Toggle label="open question" on={t.attention} set={(v) => patch({ attention: v })} />
            <Toggle label="person wrote since report" on={t.humanSince} set={(v) => patch({ humanSince: v })} />
          </div>
          <label className="grid gap-1 font-mono text-xs text-muted-foreground">
            latest assignment
            <select className="rounded-md border bg-background px-2 py-1 text-foreground" value={t.assignment} onChange={(e) => patch({ assignment: e.target.value as Assignment })}>
              {(["none", "pending", "running", "ended"] as Assignment[]).map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
          <label className="grid gap-1 font-mono text-xs text-muted-foreground">
            its latest report
            <select className="rounded-md border bg-background px-2 py-1 text-foreground" value={t.report} onChange={(e) => patch({ report: e.target.value as Report })}>
              {(["none", "progress", "waiting", "ready", "blocked", "failed"] as Report[]).map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
        </div>
        <ol className="grid gap-1" aria-label="stage rows, top to bottom">
          {ROWS.map((r, i) => {
            const matches = r.test(t)
            const winner = r.id === hit
            return (
              <li
                key={r.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm",
                  winner ? "border-foreground bg-foreground/10 font-medium" : matches ? "border-dashed opacity-60" : "opacity-45",
                )}
              >
                <span><span className="mr-2 font-mono text-xs text-muted-foreground">{i + 1}</span>{r.stage}</span>
                <span className="font-mono text-xs">{winner ? `-> ${r.label}` : matches ? "also true, shadowed" : ""}</span>
              </li>
            )
          })}
        </ol>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Turn on a failed delivery and an open question together: both rows are true and the panel shows only the first. Ready plus a question reads as a question, never as review.
      </figcaption>
    </figure>
  )
}

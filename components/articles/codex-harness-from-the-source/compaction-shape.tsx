"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { Chip, Panel, Src, fmt } from "./ui"

// Constants are read from the code (core/src/compact.rs:63, core/src/compact_remote_v2.rs:87-91).
// The starting history (the auto-compact limit of a 272,000-token model) is the code's arithmetic;
// the summary and initial-context sizes are illustrative.
const START = 244800
const INITIAL = 14000
const LOCAL_USER = 20000
const SUMMARY = 3000
const REMOTE_RETAIN = 64000

type Seg = { label: string; n: number; cls: string }

const BEFORE: Seg[] = [
  { label: "initial context", n: INITIAL, cls: "bg-emerald-500/40" },
  { label: "conversation, tool calls and outputs", n: START - INITIAL, cls: "bg-muted-foreground/30" },
]
const LOCAL: Seg[] = [
  { label: "initial context, re-injected", n: INITIAL, cls: "bg-emerald-500/40" },
  { label: "newest user messages, up to 20,000 tokens", n: LOCAL_USER, cls: "bg-sky-500/50" },
  { label: "summary", n: SUMMARY, cls: "bg-amber-500/60" },
]
const REMOTE: Seg[] = [
  { label: "initial context", n: INITIAL, cls: "bg-emerald-500/40" },
  { label: "retained messages, budget 64,000 (agent messages at most 10,000 each)", n: REMOTE_RETAIN, cls: "bg-sky-500/50" },
  { label: "compaction item", n: SUMMARY, cls: "bg-amber-500/60" },
]

function Bar({ title, segs }: { title: string; segs: Seg[] }) {
  const total = segs.reduce((a, s) => a + s.n, 0)
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-[12px]"><span className="font-medium">{title}</span><span className="tabular-nums text-muted-foreground">{fmt(total)} tokens</span></div>
      <div className="flex h-9 overflow-hidden rounded">
        {segs.map((s) => (
          <div key={s.label} className={cn("flex items-center justify-center overflow-hidden px-1 text-center text-[10px] leading-tight", s.cls)} style={{ width: `${(s.n / START) * 100}%` }} title={s.label}>{s.n / START > 0.11 ? s.label : ""}</div>
        ))}
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
        {segs.map((s) => (<li key={s.label}><span className={cn("mr-1 inline-block h-2 w-2 rounded-sm", s.cls)} />{s.label}: {fmt(s.n)}</li>))}
      </ul>
    </div>
  )
}

export function CompactionShape() {
  const [mode, setMode] = useState<"local" | "remote">("local")
  return (
    <Panel title="What compaction leaves behind" sub="constants read from the code; the summary and initial-context sizes are illustrative">
      <Bar title="Before: a 272,000-token model at its auto-compact limit" segs={BEFORE} />
      <div className="mb-2 flex gap-1.5 text-[12px]">
        <Chip active={mode === "local"} onClick={() => setMode("local")}>local summary compaction</Chip>
        <Chip active={mode === "remote"} onClick={() => setMode("remote")}>remote compaction v2</Chip>
      </div>
      <Bar title={mode === "local" ? "After: summary compaction" : "After: remote compaction v2"} segs={mode === "local" ? LOCAL : REMOTE} />
      <p className="text-[12.5px] text-muted-foreground">
        {mode === "local"
          ? "The summarizer prompt asks for a handoff for another model that will resume the task; the new history is the initial context again, the most recent user messages that fit in 20,000 tokens (newest first, an oversize one truncated), and one summary message with a prefix saying another model produced it."
          : "Remote compaction v2 keeps a larger retained slice, with a 64,000-token message budget and at most 10,000 tokens per retained agent message, and allows two stream retries."}{" "}
        <Src>{mode === "local" ? "core/src/compact.rs:63, 701-820" : "core/src/compact_remote_v2.rs:87-91"}</Src>
      </p>
    </Panel>
  )
}

"use client"

import { useState } from "react"

import { Chip, Panel } from "./ui"

// One sampling request on a time axis (arbitrary seconds). Rules read from
// core/src/stream_events_utils.rs:316-365 (a finished tool call is dispatched at once) and
// core/src/session/turn.rs:2676, 3137, 3552-3560 (FuturesOrdered, drained in call order after the stream).
// The seconds are illustrative; the ordering rules are the code's.
const T = 12

export function SamplingTimeline() {
  const [slow, setSlow] = useState(false)
  const [now, setNow] = useState(5)
  const aEnd = slow ? 10.5 : 6.5
  const bEnd = 7.2
  const streamEnd = 8
  const recA = Math.max(streamEnd, aEnd)
  const recB = Math.max(recA, bEnd)
  const x = (t: number) => 118 + (t / T) * 590
  const lanes = [
    { label: "model stream", bars: [{ a: 0, b: streamEnd, cls: "fill-sky-500/60", txt: "text deltas, then Completed" }], marks: [{ t: 2, k: "tool call A done" }, { t: 4, k: "tool call B done" }] },
    { label: "tool A", bars: [{ a: 2, b: aEnd, cls: "fill-amber-500/70", txt: slow ? "slow handler" : "handler" }] },
    { label: "tool B", bars: [{ a: 4, b: bEnd, cls: "fill-amber-500/70", txt: "handler" }] },
    { label: "history", bars: [{ a: recA - 0.35, b: recA, cls: "fill-emerald-500/80", txt: "" }, { a: recB - 0.35, b: recB, cls: "fill-emerald-500/80", txt: "" }], marks: [{ t: recA, k: "A recorded" }, { t: recB, k: "B recorded" }] },
  ]
  const state = () => {
    const parts: string[] = []
    if (now < streamEnd) parts.push("The model is still streaming.")
    else parts.push("The stream has ended; drain_in_flight is waiting on the futures in call order.")
    if (now >= 2 && now < aEnd) parts.push("Tool A is running.")
    if (now >= 4 && now < bEnd) parts.push("Tool B is running.")
    if (now >= bEnd && now < recB && now >= 4) parts.push(now >= aEnd ? "Tool B has finished but its output waits for A's slot." : "Tool B has finished; its output cannot be recorded before A's.")
    if (now >= recA) parts.push("A's output is in history.")
    if (now >= recB) parts.push("B's output is in history. The next request can go out.")
    return parts.join(" ")
  }
  return (
    <Panel title="While the model is still talking, the tools are already running" sub="illustrative seconds; the ordering is read from the code">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px]">
        <Chip active={!slow} onClick={() => setSlow(false)}>both tools quick</Chip>
        <Chip tone="amber" active={slow} onClick={() => setSlow(true)}>tool A is slow (outlasts the stream)</Chip>
        <label className="ml-auto flex items-center gap-2 text-muted-foreground">time
          <input type="range" min={0} max={T} step={0.1} value={now} onChange={(e) => setNow(Number(e.target.value))} className="w-40" aria-label="time" />
          <span className="w-10 tabular-nums">{now.toFixed(1)}s</span>
        </label>
      </div>
      <svg viewBox="0 0 720 210" className="w-full" role="img" aria-label="Timeline of a model stream, two tool futures and the history recorder">
        {lanes.map((l, i) => (
          <g key={l.label}>
            <text x={8} y={32 + i * 46} className="fill-muted-foreground text-[11px]">{l.label}</text>
            <line x1={118} y1={40 + i * 46} x2={708} y2={40 + i * 46} className="stroke-border" />
            {l.bars.map((b, j) => (
              <g key={j}>
                <rect x={x(b.a)} y={22 + i * 46} width={Math.max(3, x(b.b) - x(b.a))} height={20} rx={4} className={b.cls} />
                {b.txt ? <text x={x(b.a) + 6} y={36 + i * 46} className="fill-foreground text-[10px]">{b.txt}</text> : null}
              </g>
            ))}
            {(l.marks ?? []).map((m) => (
              <text key={m.k} x={x(m.t)} y={16 + i * 46} textAnchor="middle" className="fill-muted-foreground text-[9.5px]">{m.k}</text>
            ))}
          </g>
        ))}
        <line x1={x(now)} y1={6} x2={x(now)} y2={204} className="stroke-rose-500" strokeWidth={1.6} />
      </svg>
      <p className="mt-2 text-[13px] text-muted-foreground">{state()}</p>
    </Panel>
  )
}

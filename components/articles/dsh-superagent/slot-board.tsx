"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// WorkerSlots from src/executor/dsh.ts, re-implemented from reading. A ticket holds a slot while its turn runs,
// while its shell jobs or subagents run, and while a launch or wake is starting. reserve() throws Later when
// used() >= max, or max + 1 when the wake is for a person's message.

type By = "launch" | "wake" | "person"
interface Try { id: number; by: By; ok: boolean; used: number }

export function SlotBoard() {
  const [max, setMax] = useState(3)
  const [running, setRunning] = useState(3)
  const [log, setLog] = useState<Try[]>([])
  const held = log.filter((l) => l.ok).length
  const used = running + held

  const attempt = (by: By) => {
    const ok = used < max + (by === "person" ? 1 : 0)
    setLog([{ id: log.length + 1, by, ok, used: ok ? used + 1 : used }, ...log].slice(0, 12))
  }
  const reset = () => setLog([])
  const cap = max + 1
  const cells = Array.from({ length: Math.min(cap, 17) }, (_, i) => i)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">worker slots · re-implemented from src/executor/dsh.ts</span>
        <span className="font-mono text-xs">{used} used of {max} (+1 for a person)</span>
      </div>
      <div className="grid gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 font-mono text-xs text-muted-foreground">
            maxWorkers (default 3, range 1 to 16): {max}
            <Range min={1} max={16} value={max} onChange={(e) => { setMax(Number(e.target.value)); setLog([]) }} aria-label="maxWorkers" />
          </label>
          <label className="grid gap-1 font-mono text-xs text-muted-foreground">
            workers already running: {running}
            <Range min={0} max={16} value={running} onChange={(e) => { setRunning(Number(e.target.value)); setLog([]) }} aria-label="running workers" />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-hidden>
          {cells.map((i) => (
            <span
              key={i}
              className={cn(
                "h-6 w-6 rounded border",
                i >= max ? "border-dashed" : "",
                i < Math.min(running, cap) ? "bg-foreground/70" : i < used ? "bg-emerald-500/60" : "",
              )}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-md border px-3 py-1.5 font-mono text-xs hover:bg-muted/60" onClick={() => attempt("launch")}>new launch</button>
          <button type="button" className="rounded-md border px-3 py-1.5 font-mono text-xs hover:bg-muted/60" onClick={() => attempt("wake")}>CI result wakes idle worker</button>
          <button type="button" className="rounded-md border px-3 py-1.5 font-mono text-xs hover:bg-muted/60" onClick={() => attempt("person")}>a person writes</button>
          <button type="button" className="rounded-md border px-3 py-1.5 font-mono text-xs hover:bg-muted/60" onClick={reset}>reset</button>
        </div>
        <ul className="grid gap-1 font-mono text-xs" aria-live="polite">
          {log.length === 0 ? <li className="text-muted-foreground">Try a request. Dark squares are running workers, green ones are reservations, dashed ones are beyond the limit.</li> : null}
          {log.map((l) => (
            <li key={l.id} className={l.ok ? "" : "text-rose-600 dark:text-rose-400"}>
              {l.by === "launch" ? "launch" : l.by === "wake" ? "wake (CI, bot)" : "wake (person)"} {"->"} {l.ok ? `slot taken, ${l.used} in use` : "Later: no worker slot is free"}
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        With 3 running at a limit of 3, a launch and a CI wake are both refused, the first person&rsquo;s message takes a fourth slot, and a second person&rsquo;s message is refused. Measured by running our re-implementation, not DeepSeek&rsquo;s code.
      </figcaption>
    </figure>
  )
}

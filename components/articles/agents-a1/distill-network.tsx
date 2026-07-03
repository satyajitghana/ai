"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Multi-teacher domain-routed on-policy distillation, animated. The student rolls out
// a trajectory; a router reads its domain and selects the matching specialist teacher;
// that teacher's token distribution supervises the student's *own* tokens (on-policy),
// with the loss focused on the salient, capability-bearing tokens. One specialist per
// task, all folded into one student. Auto-cycles through domains; click a teacher to pin.

const TEACHERS = [
  { key: "search", name: "search teacher", task: "“Find the 2024 paper that first reported …”", hue: 25 },
  { key: "eng", name: "engineering teacher", task: "“Patch the failing test in this repo.”", hue: 150 },
  { key: "science", name: "science teacher", task: "“Derive the binding free energy for …”", hue: 265 },
  { key: "instruct", name: "instruction teacher", task: "“Answer in exactly 3 bullets, no numbers.”", hue: 320 },
  { key: "tools", name: "tool-calling teacher", task: "“Book the flight via the travel API.”", hue: 80 },
] as const

export function DistillNetwork() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % TEACHERS.length), 2400)
    return () => clearInterval(id)
  }, [playing])

  const active = TEACHERS[i]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>multi-teacher domain-routed distillation · one student</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        {/* the rolled-out task */}
        <div className="rounded-md border-l-2 bg-muted/30 px-3 py-2" style={{ borderColor: `oklch(0.72 0.14 ${active.hue})` }}>
          <div className="font-mono text-[10px] text-muted-foreground">student rollout · domain router reads the task →</div>
          <div className="mt-0.5 grid">
            {TEACHERS.map((t, k) => (
              <p
                key={t.key}
                aria-hidden={k !== i}
                className={cn(
                  "col-start-1 row-start-1 text-sm leading-6 text-foreground transition-opacity duration-300",
                  k === i ? "opacity-100" : "pointer-events-none opacity-0"
                )}
              >
                {t.task}
              </p>
            ))}
          </div>
        </div>

        {/* teachers row */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {TEACHERS.map((t, k) => {
            const on = k === i
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setI(k)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-md border px-2 py-2 text-left font-mono text-[11px] transition-all",
                  on ? "border-transparent" : "border-border opacity-50 hover:opacity-100"
                )}
                style={on ? { background: `oklch(0.72 0.14 ${t.hue} / 0.16)`, borderColor: `oklch(0.72 0.14 ${t.hue})` } : undefined}
              >
                <span className="size-2 rounded-full" style={{ background: `oklch(0.72 0.14 ${t.hue})` }} />
                <span className="truncate text-foreground">{t.name}</span>
                <span className={cn("text-[9px]", on ? "text-foreground" : "text-muted-foreground")}>
                  {on ? "routed ✓" : "idle"}
                </span>
              </button>
            )
          })}
        </div>

        <div className="py-2 text-center font-mono text-[10px] text-muted-foreground/60">
          ↓ selected teacher’s distribution supervises the student’s own tokens (on-policy) · loss focused on salient tokens
        </div>

        {/* student */}
        <div className="rounded-md border border-foreground/30 bg-background px-3 py-2.5 text-center font-mono text-xs">
          <span className="text-foreground">Agents-A1 · one 35B student</span>
          <div className="text-[10px] text-muted-foreground">inherits every specialist — no teacher shipped at inference</div>
        </div>
      </div>
    </figure>
  )
}

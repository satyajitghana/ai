"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One actor's life in Agent Substrate, step by step, with who causes each
// transition and where its state lives. Read from the source at e472ffb:
//   cmd/ateapi/internal/controlapi/workflow_resume.go   ResumeActor: lease, assign, restore, RUNNING
//   cmd/ateapi/internal/scheduling/scheduling.go        power of two choices over workers with room
//   cmd/atenet/internal/router                          ext_proc resumes on a routed request; parking
//   cmd/ateapi/internal/controlapi/workflow_suspend.go  SuspendActor, called by a client
//   cmd/atelet/internal/snapshottracker/background.go   upload after 5 min, detach after 30 min
//   internal/ateworker/suspend/suspend.go               the worker-initiated path, not called yet
// A static walk-through, not a live system.

const ACCENT = "oklch(0.58 0.15 250)"

type Who = "you" | "router" | "control" | "node" | "nobody"

const WHO: Record<Who, { label: string; color: string }> = {
  you: { label: "your harness calls it", color: "oklch(0.62 0.16 40)" },
  router: { label: "atenet-router, on a request", color: "oklch(0.58 0.15 250)" },
  control: { label: "ate-api-server", color: "oklch(0.55 0.13 160)" },
  node: { label: "atelet, on the node", color: "oklch(0.55 0.12 300)" },
  nobody: { label: "nothing calls it yet", color: "oklch(0.55 0.02 260)" },
}

type Step = {
  state: string
  call: string
  who: Who
  text: string
  where: string
}

const STEPS: Step[] = [
  {
    state: "SUSPENDED",
    call: "CreateActor",
    who: "you",
    text: "The record goes into PostgreSQL already suspended, pointing at the template's golden snapshot: a boot plus checkpoint taken once per ActorTemplate.",
    where: "golden snapshot, object storage",
  },
  {
    state: "RESUMING",
    call: "ResumeActor",
    who: "router",
    text: "A request carrying ate-target-actor reaches Envoy; the ext_proc asks the control plane to resume. A running actor returns at once, without taking the lease.",
    where: "still in storage",
  },
  {
    state: "RESUMING",
    call: "assign + restore",
    who: "control",
    text: "Under a per-actor PostgreSQL lease, the scheduler samples two workers with room and takes the less loaded. atelet restores the snapshot into that worker's sandbox and waits for the wakeup probe.",
    where: "node-local copy, else downloaded",
  },
  {
    state: "RUNNING",
    call: "traffic",
    who: "router",
    text: "The router opens an mTLS CONNECT tunnel to atunnel on the worker, which forwards into the actor's network namespace. Outbound traffic goes the other way, to the egress gateway.",
    where: "worker RAM, booked at the limit",
  },
  {
    state: "SUSPENDING",
    call: "SuspendActor",
    who: "you",
    text: "Something outside Substrate decides the actor is idle and says so. The worker-side path for an idleness signal exists in internal/ateworker/suspend, but nothing calls it in this commit.",
    where: "checkpoint written on the node",
  },
  {
    state: "SUSPENDED",
    call: "upload, later detach",
    who: "node",
    text: "Asynchronous by default: the call returns once the local checkpoint is written. atelet uploads it after 5 minutes and drops the local copy after 30, so a quick resume on the same node skips the download.",
    where: "node, then object storage",
  },
]

export function ActorLifecycle() {
  const [i, setI] = useState(0)
  const s = STEPS[i]
  const w = WHO[s.who]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one actor, one lifecycle · who moves it</span>
        <span className="text-muted-foreground/50">
          step {i + 1} / {STEPS.length}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <ol className="mb-4 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {STEPS.map((st, j) => (
            <li key={j}>
              <button
                type="button"
                onClick={() => setI(j)}
                aria-current={j === i ? "step" : undefined}
                className={cn(
                  "w-full rounded-md border px-1.5 py-2 text-left font-mono text-[10px] leading-4 transition-colors",
                  j === i ? "bg-background" : "opacity-70 hover:opacity-100",
                )}
                style={j === i ? { borderColor: ACCENT } : undefined}
              >
                <span className="block text-muted-foreground">{st.state}</span>
                <span className="block text-foreground">{st.call}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="rounded-lg border bg-background/40 p-3">
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">
              <span style={{ color: w.color }}>{w.label}</span>
              {" · "}
              <code>{s.call}</code>
            </div>
            <p className="text-sm leading-6">{s.text}</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="rounded-lg border bg-background/40 px-3 py-2">
              <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">state</div>
              <div className="font-mono text-lg font-semibold" style={{ color: ACCENT }}>
                {s.state}
              </div>
            </div>
            <div className="rounded-lg border bg-background/40 px-3 py-2">
              <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                where the actor lives
              </div>
              <div className="font-mono text-sm">{s.where}</div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setI((j) => Math.max(0, j - 1))}
            disabled={i === 0}
            className="rounded-md border px-3 py-1 font-mono text-xs disabled:opacity-40"
          >
            back
          </button>
          <button
            type="button"
            onClick={() => setI((j) => Math.min(STEPS.length - 1, j + 1))}
            disabled={i === STEPS.length - 1}
            className="rounded-md border px-3 py-1 font-mono text-xs disabled:opacity-40"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            next
          </button>
        </div>
      </div>

      <p className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
        Read from the Agent Substrate source at commit e472ffb (workflow_resume.go,
        workflow_suspend.go, scheduling.go, snapshottracker). The 5 and 30 minute delays are the
        atelet defaults for --snapshot-upload-delay and --snapshot-detach-delay.
      </p>
    </figure>
  )
}

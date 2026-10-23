"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// A SPACE sandbox as a state machine. Press an action and watch what the
// sandbox is holding, and where. Everything here is read from the repo at
// b9fc395: the state table in docs/architecture.md ("Lifecycle and
// persistence"), the native operations in crates/libs/public/api/src/routes.rs,
// the Firecracker snapshot settings in crates/libs/node/runtime/core/src/fc_api.rs
// (Diff snapshots, File memory backend, dirty-page tracking), the btrfs
// rootfs handling in docs/space/design/rootfs-backing.md and
// docs/snapshot-upload-streaming.md, and the three fork phases in
// crates/libs/api/src/fork_operations.rs. Nothing here talks to a server.

type State = "running" | "paused" | "suspended" | "deleted"

type Facts = {
  title: string
  exec: string
  memory: string
  disk: string
  where: string
  tone: string
}

const FACTS: Record<State, Facts> = {
  running: {
    title: "Running",
    exec: "vCPUs scheduled; processes run inside the guest",
    memory: "Live guest RAM, mapped by the Firecracker process on the worker",
    disk: "Writable ext4 rootfs: a btrfs copy-on-write clone of the template image",
    where: "One worker node. A jailed Firecracker plus a per-sandbox gateway in its own network namespace",
    tone: "oklch(0.58 0.14 150)",
  },
  paused: {
    title: "Paused",
    exec: "vCPUs stopped; nothing runs",
    memory: "Still resident on the worker. Not a durable snapshot",
    disk: "Still on the worker, unchanged",
    where: "Same worker, same VM process. Cheap to resume, lost if the worker dies",
    tone: "oklch(0.66 0.14 75)",
  },
  suspended: {
    title: "Suspended",
    exec: "No guest execution; the VM is gone",
    memory: "A Firecracker Diff snapshot: VM state plus the dirty pages, sized by what was written rather than by total RAM",
    disk: "The root filesystem, shipped as a btrfs send stream against its template parent",
    where: "Object storage. Worker CPU and RAM are released; wake can restore elsewhere",
    tone: "oklch(0.60 0.13 255)",
  },
  deleted: {
    title: "Deleted",
    exec: "None",
    memory: "None",
    disk: "None reachable through the API",
    where: "Nowhere you can address. Create another sandbox if you need one",
    tone: "oklch(0.55 0.02 260)",
  },
}

type Action = {
  id: string
  label: string
  op: string
  from: State[]
  to: State
  note: string
  supported: boolean
}

const ACTIONS: Action[] = [
  { id: "pause", label: "pause", op: ":pause", from: ["running"], to: "paused", supported: true,
    note: "Stops the vCPUs. Memory and disk stay where they are, so this is fast and not durable." },
  { id: "suspend", label: "suspend", op: ":suspend", from: ["running"], to: "suspended", supported: true,
    note: "Writes a Diff memory snapshot and the rootfs to object storage, then releases the VM. Also happens on its own after six hours idle." },
  { id: "wake", label: "wake", op: ":wake", from: ["paused", "suspended"], to: "running", supported: true,
    note: "Paused: thaw the same VM. Suspended: load the snapshot (File memory backend, dirty-page tracking on) and restore the rootfs, then check guest readiness." },
  { id: "delete", label: "delete", op: "DELETE", from: ["running", "paused", "suspended"], to: "deleted", supported: true,
    note: "Tears the sandbox down. A finished command never does this for you." },
  { id: "create", label: "create", op: "POST /v1/sandboxes", from: ["deleted"], to: "running", supported: true,
    note: "Resolves a template, clones its rootfs, boots or restores a VM, and returns an operation ID to poll." },
]

const FORK_PHASES = [
  { id: "SourceFreeze", text: "Freeze the source so memory and disk agree" },
  { id: "ArtifactMaterialization", text: "Capture a snapshot of it into object storage" },
  { id: "TargetRestore", text: "Restore that snapshot as a new sandbox" },
]

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2 border-t px-3 py-2 text-[12px] leading-snug first:border-t-0">
      <span className="font-mono text-[11px] text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  )
}

export function SandboxLifecycle() {
  const [state, setState] = useState<State>("running")
  const [last, setLast] = useState<string>(
    "A fresh sandbox. Press an action; disabled ones are not valid from this state.",
  )
  const [forks, setForks] = useState(0)
  const [phase, setPhase] = useState(-1)
  const f = FACTS[state]
  const canFork = state !== "deleted"

  function run(a: Action) {
    setState(a.to)
    setLast(`${a.op}: ${a.note}`)
    setPhase(-1)
    if (a.to === "deleted") setForks(0)
  }

  function fork() {
    if (!canFork) return
    const next = phase + 1
    if (next < FORK_PHASES.length) {
      setPhase(next)
      setLast(`fork, phase ${next + 1} of 3 (${FORK_PHASES[next].id}): ${FORK_PHASES[next].text}.`)
      if (next === FORK_PHASES.length - 1) setForks((n) => n + 1)
    } else {
      setPhase(-1)
      setLast("Fork done. The child is a separate sandbox with its own VM and gateway; the parent is untouched.")
    }
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one sandbox · what it holds, and where</span>
        <span
          className="rounded-full px-2 py-0.5 font-mono text-[11px] font-medium"
          style={{ color: f.tone, background: "color-mix(in oklch, currentColor 12%, transparent)" }}
        >
          {f.title.toLowerCase()}
        </span>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.3fr]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lifecycle actions">
            {ACTIONS.map((a) => {
              const ok = a.from.includes(state)
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={!ok}
                  onClick={() => run(a)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                    ok ? "bg-background hover:border-foreground/40" : "cursor-not-allowed opacity-35",
                  )}
                >
                  {a.label}
                </button>
              )
            })}
            <button
              type="button"
              disabled={!canFork}
              onClick={fork}
              className={cn(
                "rounded-md border border-dashed px-2.5 py-1 font-mono text-[11px] transition-colors",
                canFork ? "bg-background hover:border-foreground/40" : "cursor-not-allowed opacity-35",
              )}
            >
              {phase >= 0 && phase < FORK_PHASES.length - 1 ? "fork: next phase" : "fork"}
            </button>
          </div>

          <ol className="space-y-1">
            {FORK_PHASES.map((p, i) => (
              <li
                key={p.id}
                className={cn(
                  "flex items-baseline gap-2 rounded-md px-2 py-1 text-[11px]",
                  i <= phase ? "bg-background text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="font-mono">{i + 1}</span>
                <span className="font-mono">{p.id}</span>
              </li>
            ))}
          </ol>

          <p className="text-[12px] leading-relaxed text-muted-foreground" aria-live="polite">
            {last}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            children forked from this sandbox: {forks}
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border bg-background/60">
          <Row k="execution" v={f.exec} />
          <Row k="memory" v={f.memory} />
          <Row k="disk" v={f.disk} />
          <Row k="lives in" v={f.where} />
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Read from the SPACE repo at <code>b9fc395</code>: the state table in <code>docs/architecture.md</code>, the
        snapshot settings in <code>fc_api.rs</code> and the fork phases in <code>fork_operations.rs</code>. Pause,
        suspend and wake are in the supported API contract; fork is served by the E2B-compatible surface, and the
        native checkpoint, rollback and restore actions are marked incubating.
      </figcaption>
    </figure>
  )
}

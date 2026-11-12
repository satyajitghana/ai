"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One communicator's life through a failure and a recovery. The gloo column is MEASURED: it is the run in the
// article (four CPU processes on an M1 Max, torch 2.15.0 and 2.14.1 from PyPI, identical on both). The NCCL column
// is READ from the v2.15.0 sources (torch/csrc/distributed/c10d/nccl2/ReconfigureNCCL.cpp) and PR #199240; it was
// not run, because this machine has no NVIDIA GPU. Both backends share the handle format and the rule that a
// handle's position in the list becomes its new rank.

type Proc = "up" | "idle" | "dead" | "waiting" | "joined"
type Step = {
  title: string
  procs: [Proc, Proc, Proc, Proc]
  ranks: [string, string, string, string]
  comm: string
  gloo: string
  ncclFull: string
  ncclFast?: string
  log?: string
}

const STEPS: Step[] = [
  {
    title: "Create the group",
    procs: ["idle", "idle", "idle", "idle"],
    ranks: ["0", "1", "2", "3"],
    comm: "no communicator yet",
    gloo: "init_process_group(\"gloo\", enable_reconfigure=True) on all four processes. The group exists but nothing is connected. Each process can print its handle, gloo:<rank>:-1:<rank>:<store>; the -1 means no generation has been built.",
    ncclFull: "A reconfigurable nccl group also waits for reconfigure(). An ordinary nccl group in 2.15 does not wait: it builds its communicator right here, inside init_process_group or new_group. That is the eager change.",
  },
  {
    title: "Build generation 1",
    procs: ["up", "up", "up", "waiting"],
    ranks: ["0", "1", "2", "-"],
    comm: "uuid 1 · 3 members",
    gloo: "Processes 0, 1 and 2 publish their handles in the store, read each other's, and call _reconfigure(uuid=1, handles=[h0, h1, h2]). Process 3 is a spare and stays out.",
    ncclFull: "New rank 0 claims uuid 1 in the store, creates an ncclUniqueId and publishes it. Every member then runs ncclCommInitRankConfig: a full bootstrap.",
  },
  {
    title: "Collective",
    procs: ["up", "up", "up", "waiting"],
    ranks: ["0", "1", "2", "-"],
    comm: "uuid 1 · 3 members",
    gloo: "Each rank contributes its process number plus one. all_reduce returns 1 + 2 + 3 = 6 on every rank.",
    ncclFull: "Same contract. The collective is enqueued on the group's CUDA stream and the watchdog tracks it.",
    log: "[rank0] gen1 rank 0 size 3 all_reduce 6.0",
  },
  {
    title: "A rank dies",
    procs: ["up", "up", "dead", "waiting"],
    ranks: ["0", "1", "x", "-"],
    comm: "uuid 1 · still lists 3",
    gloo: "Process 2 calls os._exit(0). Nothing notices yet: the communicator still believes it has three members, and nobody has asked it to do anything.",
    ncclFull: "Same. A dead peer is only discovered when someone waits on it.",
  },
  {
    title: "The next collective hangs",
    procs: ["up", "up", "dead", "waiting"],
    ranks: ["0", "1", "x", "-"],
    comm: "uuid 1 · broken",
    gloo: "Ranks 0 and 1 call all_reduce. Gloo's transport waits for rank 2's bytes until the group timeout (5 s in this run), then raises RuntimeError on both survivors.",
    ncclFull: "The watchdog sees the timeout. In 2.15 the flight recorder is attached to the new backend, and a health failure on any rank asks the debug server for a dump from every rank, so the post-mortem shows which rank stopped where.",
    log: "[rank0] collective with dead peer failed after 5.0 s: RuntimeError ... Timed out waiting 5000ms",
  },
  {
    title: "Shrink to generation 2",
    procs: ["up", "up", "dead", "waiting"],
    ranks: ["0", "1", "x", "-"],
    comm: "uuid 2 · 2 members",
    gloo: "The survivors exchange handles again and call _reconfigure(uuid=2, handles=[h0, h1]). Gloo always reconnects from scratch; on loopback that took about 2 ms.",
    ncclFull: "Revoke in-flight work, stop the watchdog, drain the queue, abort the old communicator, then a fresh ncclCommInitRankConfig on every survivor.",
    ncclFast: "Both handles carry the previous uuid 1, they come first and in ascending old-rank order, so they form a quorum. Survivors call ncclCommShrink(NCCL_SHRINK_ABORT) to cut rank 2 out of the communicator they already have. No new bootstrap.",
  },
  {
    title: "Collective on two",
    procs: ["up", "up", "dead", "waiting"],
    ranks: ["0", "1", "x", "-"],
    comm: "uuid 2 · 2 members",
    gloo: "all_reduce returns 1 + 2 = 3. Training could carry on at reduced width here, which is what fault-tolerant trainers such as torchft do.",
    ncclFull: "Same result on the new communicator.",
    log: "[rank0] gen2 (shrunk) rank 0 size 2 all_reduce 3.0",
  },
  {
    title: "Grow to generation 3",
    procs: ["up", "up", "dead", "joined"],
    ranks: ["0", "1", "x", "2"],
    comm: "uuid 3 · 3 members",
    gloo: "The spare joins: _reconfigure(uuid=3, handles=[h0, h1, h3]). Its position in the list makes process 3 the new rank 2.",
    ncclFull: "Everyone, joiner included, bootstraps a new communicator from a fresh ncclUniqueId.",
    ncclFast: "The quorum (old ranks 0 and 1) comes first, so the fast path holds: rank 0 publishes a grow id from the shrunk communicator, survivors call ncclCommGrow, and the joiner grows from nothing. Had the joiner been listed first, every rank would fall back to a fresh init.",
  },
  {
    title: "Collective on three",
    procs: ["up", "up", "dead", "joined"],
    ranks: ["0", "1", "x", "2"],
    comm: "uuid 3 · 3 members",
    gloo: "all_reduce returns 1 + 2 + 4 = 7, and all three processes then destroy the group and exit with code 0.",
    ncclFull: "Same contract. Each reconfigure needs a fresh uuid; reusing one is rejected, because the uuid namespaces that generation's keys in the store.",
    log: "[rank3] gen3 (grown) rank 2 size 3 all_reduce 7.0",
  },
]

const FILL: Record<Proc, string> = {
  up: "fill-primary/15 stroke-primary",
  idle: "fill-muted stroke-border",
  dead: "fill-destructive/10 stroke-destructive",
  waiting: "fill-transparent stroke-border",
  joined: "fill-primary/15 stroke-primary",
}

export function LifecycleStepper() {
  const [i, setI] = useState(0)
  const [fast, setFast] = useState(false)
  const s = STEPS[i]
  const live = s.procs.map((p, k) => (p === "up" || p === "joined" ? k : -1)).filter((k) => k >= 0)
  return (
    <figure className="not-prose my-8 rounded-lg border border-border p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40">
          Back
        </button>
        <button type="button" onClick={() => setI(Math.min(STEPS.length - 1, i + 1))} disabled={i === STEPS.length - 1} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40">
          Next
        </button>
        <span className="text-xs text-muted-foreground">
          Step {i + 1} of {STEPS.length}: <b className="text-foreground">{s.title}</b>
        </span>
        <label className="ml-auto flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} />
          NCCL shrink/grow fast path
        </label>
      </div>
      <svg viewBox="0 0 520 148" role="img" className="h-auto w-full">
        <title>{`Four processes; ${s.comm}. ${s.title}.`}</title>
        {live.length > 1 && (
          <g className="fill-none stroke-primary" strokeWidth={2.5} strokeDasharray={s.comm.includes("broken") ? "6 5" : undefined}>
            <path d={`M${65 + live[0] * 130},110 L${65 + live[live.length - 1] * 130},110`} />
            {live.map((k) => (
              <path key={k} d={`M${65 + k * 130},94 L${65 + k * 130},110`} />
            ))}
          </g>
        )}
        {s.procs.map((p, k) => (
          <g key={k}>
            <rect x={20 + k * 130} y={30} width={90} height={64} rx={8} className={FILL[p]} strokeWidth={1.5} strokeDasharray={p === "waiting" ? "4 4" : undefined} />
            <text x={65 + k * 130} y={22} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              process {k}
            </text>
            <text x={65 + k * 130} y={60} textAnchor="middle" className="fill-foreground text-[13px] font-medium">
              {p === "dead" ? "dead" : p === "waiting" ? "spare" : p === "idle" ? "no comm" : `rank ${s.ranks[k]}`}
            </text>
            <text x={65 + k * 130} y={80} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {p === "dead" ? "exited" : p === "waiting" ? "waiting" : p === "idle" ? "handle uuid -1" : "in generation"}
            </text>
          </g>
        ))}
        <text x={260} y={136} textAnchor="middle" className="fill-foreground text-[12px]">
          {s.comm}
        </text>
      </svg>
      <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2" aria-live="polite">
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">gloo, what ran</div>
          <p>{s.gloo}</p>
          {s.log && <pre className="mt-2 overflow-x-auto rounded bg-muted px-2 py-1 text-[11px]">{s.log}</pre>}
        </div>
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            nccl in 2.15, read from source {s.ncclFast ? (fast ? "· fast path" : "· full re-init") : ""}
          </div>
          <p className={cn(s.ncclFast && fast && "text-primary")}>{s.ncclFast && fast ? s.ncclFast : s.ncclFull}</p>
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        The left column is my run on CPU with gloo (same on 2.14.1 and 2.15.0). The right column is what the 2.15 nccl backend does at the same step, read from its source; the fast path needs TORCH_NCCL2_RECONFIGURE_SHRINK_GROW=1 on every rank and NCCL 2.29 or newer.
      </figcaption>
    </figure>
  )
}

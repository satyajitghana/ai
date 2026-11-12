"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// How a backend name resolves in 2.14.1 and 2.15.0. READ from both wheels' torch/distributed/distributed_c10d.py and
// their entry_points.txt (installed from PyPI): all four names are registered in both versions; what changed is which
// creator "nccl" picks. In 2.14.1 it is nccl2 only if TORCH_DIST_USE_NCCL2 == "1"; in 2.15.0 it is nccl2 unless the
// variable == "0". The variable is read when "nccl" is first registered, i.e. the first time a process asks for it.
// Not run: the macOS wheels have no NCCL (dist.is_nccl_available() is False).

type Ver = "2.14" | "2.15"
type Env = "unset" | "1" | "0"

const NAMES = ["nccl", "nccl2", "nccl-lazy", "nccl-legacy"] as const
type Name = (typeof NAMES)[number]

function resolve(v: Ver, name: Name, env: Env): { impl: string; fresh: boolean; note: string } {
  if (name === "nccl-legacy")
    return { impl: "legacy ProcessGroupNCCL", fresh: false, note: v === "2.15" ? "Kept for this release only; the release notes say it is removed in the next one, with the variable." : "Already registered in 2.14.1, equal to plain nccl there." }
  if (name === "nccl2")
    return v === "2.15"
      ? { impl: "ProcessGroupNCCL2 (eager)", fresh: true, note: "Same object plain nccl now builds." }
      : { impl: "ProcessGroupNCCL2 (lazy)", fresh: true, note: "The opt-in name during the preview. It still built its communicator at the first collective; PR #192895 made it eager for 2.15." }
  if (name === "nccl-lazy")
    return { impl: "ProcessGroupNCCLLazy", fresh: true, note: "Collectives on one eager communicator; each send/recv peer pair gets its own lazily created communicator and stream, so P2P to different peers overlaps. The release notes recommend it for pipeline parallelism." }
  const toNew = v === "2.15" ? env !== "0" : env === "1"
  return toNew
    ? { impl: v === "2.15" ? "ProcessGroupNCCL2 (eager)" : "ProcessGroupNCCL2 (lazy)", fresh: true, note: v === "2.15" ? "The new default. Communicators are built inside init_process_group and new_group, and the group binds to one GPU (device_id, else LOCAL_RANK modulo the device count)." : "TORCH_DIST_USE_NCCL2=1 was the 2.14 opt-in." }
    : { impl: "legacy ProcessGroupNCCL", fresh: false, note: v === "2.15" ? "TORCH_DIST_USE_NCCL2=0 is the rollback. Set it on every rank, before the first group is created." : "The 2.14 default: communicators built lazily at the first collective." }
}

export function BackendSwitch() {
  const [v, setV] = useState<Ver>("2.15")
  const [name, setName] = useState<Name>("nccl")
  const [env, setEnv] = useState<Env>("unset")
  const r = resolve(v, name, env)
  const pill = (on: boolean) => cn("rounded-full border border-border px-3 py-1 text-xs", on ? "bg-primary text-primary-foreground" : "hover:bg-muted")
  return (
    <figure className="not-prose my-8 rounded-lg border border-border p-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2" role="group" aria-label="PyTorch version">
          {(["2.14", "2.15"] as Ver[]).map((x) => (
            <button key={x} type="button" aria-pressed={v === x} onClick={() => setV(x)} className={pill(v === x)}>
              torch {x}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="TORCH_DIST_USE_NCCL2">
          <span className="font-mono text-xs text-muted-foreground">TORCH_DIST_USE_NCCL2</span>
          {(["unset", "1", "0"] as Env[]).map((x) => (
            <button key={x} type="button" aria-pressed={env === x} onClick={() => setEnv(x)} className={pill(env === x)}>
              {x}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Backend name">
        {NAMES.map((x) => (
          <button key={x} type="button" role="radio" aria-checked={name === x} onClick={() => setName(x)} className={cn("rounded border border-border px-2 py-1 font-mono text-xs", name === x ? "bg-muted" : "hover:bg-muted/50")}>
            backend=&quot;{x}&quot;
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3" aria-live="polite">
        <span className="text-xs text-muted-foreground">init_process_group</span>
        <span aria-hidden="true">→</span>
        <span className={cn("rounded-md border px-3 py-1.5 text-sm font-medium", r.fresh ? "border-primary" : "border-border")}>{r.impl}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{r.note}</p>
      <figcaption className="mt-3 text-xs text-muted-foreground">Read from the registration code in both wheels, not run: the macOS wheels ship without NCCL.</figcaption>
    </figure>
  )
}

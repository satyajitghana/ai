"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// How a process group created with backend "nccl" resolves. REPORTED from the 2.15 release blog and notes, not
// run: the CPU wheel has no NCCL (dist.is_nccl_available() is False there), so I could not exercise the switch.

type Ver = "2.14" | "2.15"
type Opt = { id: string; label: string }

const OPTS: Opt[] = [
  { id: "plain", label: 'backend="nccl"' },
  { id: "nccl2", label: 'backend="nccl2"' },
  { id: "legacy", label: 'backend="nccl-legacy"' },
  { id: "env0", label: 'backend="nccl" + TORCH_DIST_USE_NCCL2=0' },
]

function resolve(v: Ver, o: string): { impl: string; note: string } {
  if (o === "legacy") return v === "2.15" ? { impl: "legacy ProcessGroupNCCL", note: "The named rollback path." } : { impl: "legacy ProcessGroupNCCL", note: "Unconfirmed: the string nccl-legacy appears once in the 2.14.1 Python sources too, and nccl was legacy anyway." }
  if (o === "nccl2") return v === "2.15" ? { impl: "rewritten backend", note: "Still accepted; nccl now means the same thing." } : { impl: "rewritten backend (preview)", note: "The opt-in name in 2.14." }
  if (o === "env0") return v === "2.15" ? { impl: "legacy ProcessGroupNCCL", note: "The environment variable turns the new default off." } : { impl: "legacy ProcessGroupNCCL", note: "Already the default in 2.14; the variable changes nothing." }
  return v === "2.15" ? { impl: "rewritten backend", note: "The default for every nccl process group." } : { impl: "legacy ProcessGroupNCCL", note: "The default until 2.15." }
}

export function BackendSwitch() {
  const [v, setV] = useState<Ver>("2.15")
  const [o, setO] = useState("plain")
  const r = resolve(v, o)
  const fresh = r.impl.startsWith("rewritten")
  return (
    <figure className="not-prose my-8 rounded-lg border border-border p-4">
      <div className="mb-3 flex gap-2" role="group" aria-label="PyTorch version">
        {(["2.14", "2.15"] as Ver[]).map((x) => (
          <button key={x} type="button" aria-pressed={v === x} onClick={() => setV(x)} className={cn("rounded-full border border-border px-3 py-1 text-xs", v === x ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
            torch {x}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How the group is requested">
        {OPTS.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={o === x.id} onClick={() => setO(x.id)} className={cn("rounded border border-border px-2 py-1 font-mono text-xs", o === x.id ? "bg-muted" : "hover:bg-muted/50")}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3" aria-live="polite">
        <span className="text-xs text-muted-foreground">init_process_group</span>
        <span aria-hidden="true">→</span>
        <span className={cn("rounded-md border px-3 py-1.5 text-sm font-medium", fresh ? "border-primary" : "border-border")}>{r.impl}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{r.note}</p>
      <figcaption className="mt-3 text-xs text-muted-foreground">Reported from the release blog, not run: the CPU wheel has no NCCL.</figcaption>
    </figure>
  )
}

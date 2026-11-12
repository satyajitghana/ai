"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What eager communicator creation costs in GPU memory. Per-group figures are REPORTED in pytorch/pytorch issue
// #199957 (torch 2.15.0.dev20261002+cu134, NCCL 2.30.7, 2x H100 96GB, 9 groups):
//   nccl2 default: +2080 MiB after 9 new_group calls, +4672 MiB after one all_reduce per group
//   legacy (TORCH_DIST_USE_NCCL2=0): +0 MiB, then +4672 MiB
//   nccl2 + NCCL_COMM_SPLIT_SHARE_RESOURCES=1: +1188 MiB, then +1188 MiB
// lazy_init (PR #200020) is drawn like legacy: its PR reports +0 MiB at new_group and no change after use.
// Scaling those 9-group totals linearly to other group counts is REASONED, not measured.

const N = 9
const EAGER_CREATE = 2080 / N // ~231 MiB
const USED = 4672 / N // ~519 MiB once a group has run a collective
const SHARED = 1188 / N // 132 MiB

type Mode = "eager" | "legacy" | "lazy" | "shared"
const MODES: { id: Mode; label: string; note: string }[] = [
  { id: "eager", label: "nccl (2.15 default)", note: "Every group pays at creation, used or not." },
  { id: "legacy", label: "nccl-legacy", note: "Pays on first use only. Removed in the next release." },
  { id: "lazy", label: "nccl + lazy_init", note: "ProcessGroupNCCL.Options.lazy_init: create on first use, keep the new backend." },
  { id: "shared", label: "nccl + split share", note: "NCCL_COMM_SPLIT_SHARE_RESOURCES=1: split communicators share resources." },
]

function cost(m: Mode, groups: number, used: number): { create: number; after: number } {
  if (m === "eager") return { create: groups * EAGER_CREATE, after: groups * EAGER_CREATE + used * (USED - EAGER_CREATE) }
  if (m === "shared") return { create: groups * SHARED, after: groups * SHARED }
  return { create: 0, after: used * USED }
}

const fmt = (mib: number) => (mib >= 1024 ? `${(mib / 1024).toFixed(2)} GiB` : `${Math.round(mib)} MiB`)

export function EagerCost() {
  const [groups, setGroups] = useState(10)
  const [used, setUsed] = useState(3)
  const u = Math.min(used, groups)
  const max = cost("eager", 16, 16).after
  return (
    <figure className="not-prose my-8 rounded-lg border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">
          Groups created: <b>{groups}</b>
          <Range min={1} max={16} value={groups} onChange={(e) => setGroups(Number(e.target.value))} className="mt-1 w-full" />
        </label>
        <label className="text-xs">
          Groups that ever run a collective: <b>{u}</b>
          <Range min={0} max={groups} value={u} onChange={(e) => setUsed(Number(e.target.value))} className="mt-1 w-full" />
        </label>
      </div>
      <div className="mt-4 space-y-3">
        {MODES.map((m) => {
          const c = cost(m.id, groups, u)
          return (
            <div key={m.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <span className="font-mono">{m.label}</span>
                <span className="text-muted-foreground">
                  at creation <b className="text-foreground">{fmt(c.create)}</b> · after use <b className="text-foreground">{fmt(c.after)}</b>
                </span>
              </div>
              <div className="relative mt-1 h-3 rounded bg-muted" aria-hidden="true">
                <div className="absolute inset-y-0 left-0 rounded bg-primary/30" style={{ width: `${(100 * c.after) / max}%` }} />
                <div className={cn("absolute inset-y-0 left-0 rounded", m.id === "eager" ? "bg-primary" : "bg-primary/70")} style={{ width: `${(100 * c.create) / max}%` }} />
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{m.note}</p>
            </div>
          )
        })}
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Per-GPU memory. Dark bar: allocated when the groups are created. Light bar: after each used group has run one all_reduce. Per-group costs come from the 9-group H100 measurement in issue #199957; scaling them to other counts assumes each group costs the same.
      </figcaption>
    </figure>
  )
}

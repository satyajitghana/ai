"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What the 2.15 release blog spends its words on. COUNTED, not measured: each row is the number of distinct
// PR numbers cited in that section of the blog (pytorch.org/blog/pytorch-2-15-release-blog, 28 Oct 2026).
// The sections sum to 108 citations; the release is 3,117 commits, so the blog names about 3.5% of them.
// A PR cited in two sections is counted in both, so treat 108 as an upper bound on distinct PRs.

type Area = { id: string; label: string; prs: number; parts: [string, number][] }

const AREAS: Area[] = [
  { id: "dist", label: "Distributed", prs: 24, parts: [["Rewritten NCCL backend", 9], ["One-sided transports (NIXL)", 4], ["FSDP2 and pipelining", 11]] },
  { id: "mps", label: "Apple Silicon (MPS)", prs: 25, parts: [["Native Metal kernels for decode", 15], ["FP8, streams, grouped_mm", 10]] },
  { id: "nv", label: "NVIDIA / CUDA", prs: 21, parts: [["CUDA 13.2 and 13.4 wheels", 9], ["NVGEMM for NVFP4 decode", 6], ["Cuspy graph attribution", 6]] },
  { id: "amd", label: "AMD / ROCm", prs: 15, parts: [["FlyDSL and Tensor Data Mover", 11], ["ROCm 10.0 and TheRock wheels", 4]] },
  { id: "xpu", label: "Intel XPU", prs: 11, parts: [["SYCL free-function kernels", 5], ["IPC events, MemPool policies", 5], ["Profiling", 1]] },
  { id: "py", label: "Python / Dynamo", prs: 6, parts: [["Python 3.15 in torch.compile", 6]] },
  { id: "abi", label: "C++ stable ABI", prs: 6, parts: [["torch::stable::sort, header-only util", 6]] },
]

const MAX = 25

export function ChangeMap() {
  const [sel, setSel] = useState("dist")
  const cur = AREAS.find((a) => a.id === sel) ?? AREAS[0]
  return (
    <figure className="not-prose my-8 rounded-lg border border-border p-4">
      <div role="radiogroup" aria-label="Area of the release" className="space-y-1.5">
        {AREAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={a.id === sel}
            onClick={() => setSel(a.id)}
            className={cn(
              "grid w-full grid-cols-[9.5rem_1fr_2rem] items-center gap-2 rounded px-1 py-0.5 text-left text-sm",
              a.id === sel ? "bg-muted" : "hover:bg-muted/50",
            )}
          >
            <span className="truncate">{a.label}</span>
            <span className="h-3 rounded-sm bg-border">
              <span className={cn("block h-3 rounded-sm", a.id === sel ? "bg-primary" : "bg-muted-foreground/60")} style={{ width: `${(a.prs / MAX) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums">{a.prs}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 border-t border-border pt-3 text-sm" aria-live="polite">
        <p className="font-medium">{cur.label}: {cur.prs} cited PRs</p>
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {cur.parts.map(([n, c]) => (
            <li key={n} className="flex justify-between gap-4">
              <span>{n}</span>
              <span className="tabular-nums">{c}</span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Counted from the release blog: distinct PR numbers cited per section, 108 in all against 3,117 commits. A count of what the blog chose to name, not of what changed.
      </figcaption>
    </figure>
  )
}

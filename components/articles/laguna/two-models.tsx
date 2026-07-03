"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Two models, two weight classes, same MoE bet: carry a lot of parameters, pay for a
// small slice per token. M.1 is the ~200B-class flagship; XS.2 the ~30B-class open
// model. The bar shows total parameters (to scale between the two); the filled part is
// what's actually activated per token. Both are ~10× sparse — the point of MoE. Toggle
// to compare. Cross-links to the mixture-of-experts explainer.

const MODELS = [
  { key: "m1", name: "Laguna M.1", total: 225.8, active: 23.4, cls: "~200B class · flagship", open: "API / weights per report" },
  { key: "xs2", name: "Laguna XS.2", total: 33.4, active: 3.0, cls: "~30B class · open", open: "Apache-2.0 open weights" },
] as const

const MAX = 225.8
const ACCENT = "oklch(0.72 0.15 195)"
const MUTED = "oklch(0.72 0.05 230)"

export function TwoModels() {
  const [i, setI] = useState(0)
  const m = MODELS[i]
  const sparsity = (m.total / m.active).toFixed(1)
  const activePct = ((m.active / m.total) * 100).toFixed(0)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">two weight classes · total vs activated parameters</span>
        <div className="flex gap-1">
          {MODELS.map((mm, k) => (
            <button
              key={mm.key}
              type="button"
              onClick={() => setI(k)}
              aria-pressed={i === k}
              className={cn("cursor-pointer rounded px-2 py-1 font-mono transition-colors", i === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              {mm.name}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* both bars, to scale */}
        <div className="space-y-3">
          {MODELS.map((mm) => {
            const on = mm.key === m.key
            return (
              <div key={mm.key} className={cn("transition-opacity", on ? "opacity-100" : "opacity-40")}>
                <div className="mb-1 flex items-center justify-between font-mono text-[11px]">
                  <span className={on ? "text-foreground" : "text-muted-foreground"}>{mm.name}</span>
                  <span className="text-muted-foreground">{mm.total}B total · {mm.active}B active</span>
                </div>
                <div className="h-5 w-full overflow-hidden rounded bg-muted" style={{ width: `${(mm.total / MAX) * 100}%` }}>
                  <div className="flex h-full items-center" style={{ background: MUTED }}>
                    <div className="h-full" style={{ width: `${(mm.active / mm.total) * 100}%`, background: ACCENT }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded" style={{ background: ACCENT }} /> activated per token</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded" style={{ background: MUTED }} /> total (mostly dormant)</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">activated / token</div>
            <div className="font-medium" style={{ color: ACCENT }}>{m.active}B ({activePct}%)</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">sparsity</div>
            <div className="font-medium text-foreground">{sparsity}× total : active</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">class</div>
            <div className="font-medium text-foreground">{m.cls}</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {m.name} carries <span className="text-foreground">{m.total}B</span> parameters but activates only{" "}
          <span className="text-foreground">{m.active}B</span> per token — about {sparsity}× sparse, the whole
          point of a <a className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground" href="/articles/mixture-of-experts-from-scratch">mixture of experts</a>.
          Same recipe, scaled down: XS.2 is the {" "}{MODELS[1].open}.
        </p>
      </div>
    </figure>
  )
}

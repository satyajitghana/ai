"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Gated DeltaNet's update (arXiv 2412.06464, Eq. 8):
//
//   S_t = S_{t-1} ( alpha_t (I - beta_t k_t k_t^T) ) + beta_t v_t k_t^T
//
// Two knobs that do different jobs. alpha scales the WHOLE state; the rank-one
// term subtracts only the component along the current key k. So after a step,
// the surviving fraction is alpha along every direction orthogonal to k, and
// alpha(1 - beta) along k itself. Every interesting behaviour is a corner of
// that square.

const KEEP = "oklch(0.60 0.15 255)"
const GONE = "oklch(0.62 0.03 250)"

const CORNERS = [
  { a: 0.999, b: 0.02, name: "hold everything", d: "α≈1, β≈0 — the state barely moves. Long memory, no writing." },
  { a: 0.999, b: 1, name: "pure delta rule", d: "α→1, β=1 — DeltaNet. The old value at this key is erased exactly and replaced; nothing else is touched." },
  { a: 0.05, b: 0.02, name: "wipe", d: "α→0 — Mamba2-style forgetting. Everything goes at once, whether or not it was relevant." },
  { a: 0.9, b: 0.7, name: "gated delta", d: "both active — decay the whole state while overwriting this key harder than the rest." },
]

export function GatedDeltaRule() {
  const [alpha, setAlpha] = useState(0.9)
  const [beta, setBeta] = useState(0.7)

  const alongK = alpha * (1 - beta)
  const perp = alpha

  const bar = (v: number, label: string, sub: string) => (
    <div className="rounded-lg border bg-background/60 px-3 py-2.5">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-foreground">{(v * 100).toFixed(1)}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-sm" style={{ background: GONE, opacity: 0.35 }}>
        <div className="h-3 rounded-sm" style={{ width: `${v * 100}%`, background: KEEP }} />
      </div>
      <div className="mt-1 font-mono text-[9px] text-muted-foreground">{sub}</div>
    </div>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          gated delta rule · S<sub>t</sub> = S<sub>t−1</sub>(α(I − βkkᵀ)) + βvkᵀ
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">arXiv 2412.06464, Eq. 8</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {bar(perp, "survives · every direction ⊥ k", "controlled by α alone — the global forgetting knob")}
          {bar(alongK, "survives · the direction along k", "α(1 − β) — global decay AND targeted erasure")}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            α {alpha.toFixed(3)}
            <Range min={0.02} max={1} step={0.005} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} accent={KEEP} className="flex-1" aria-label="decay gate alpha" />
          </label>
          <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            β {beta.toFixed(2)}
            <Range min={0} max={1} step={0.01} value={beta} onChange={(e) => setBeta(Number(e.target.value))} accent={KEEP} className="flex-1" aria-label="delta-rule write strength beta" />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {CORNERS.map((c) => {
            const on = Math.abs(c.a - alpha) < 0.02 && Math.abs(c.b - beta) < 0.03
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => { setAlpha(c.a); setBeta(c.b) }}
                aria-pressed={on}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  on ? "border-transparent text-white" : "text-muted-foreground hover:text-foreground",
                )}
                style={on ? { background: KEEP } : undefined}
              >
                {c.name}
              </button>
            )
          })}
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[11px] text-muted-foreground">
          {CORNERS.find((c) => Math.abs(c.a - alpha) < 0.02 && Math.abs(c.b - beta) < 0.03)?.d ??
            `α = ${alpha.toFixed(3)}, β = ${beta.toFixed(2)} — the state decays to ${(perp * 100).toFixed(0)}% everywhere and to ${(alongK * 100).toFixed(0)}% along the current key.`}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The paper&rsquo;s argument is that these two knobs are{" "}
          <span className="text-foreground">complementary rather than redundant</span>, and the two bars are why.
          α is a blunt instrument: it scales everything the state holds, so it can dump a whole stale context at a
          topic switch but cannot forget one fact and keep the rest. β is a scalpel: it subtracts precisely the
          component along the key being written, so it can overwrite one association without disturbing anything
          else — but it can only ever touch one key per step, so clearing a long context takes as many steps as
          there were keys. DeltaNet had the scalpel and no way to clear the table; Mamba2 had the table-clearing and
          no scalpel. The gated delta rule is just both terms in the same product.
        </p>
      </div>
    </figure>
  )
}

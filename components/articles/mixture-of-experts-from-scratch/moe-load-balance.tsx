"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Expert collapse, made tangible. Toggle between a balanced router and a
// collapsed one: without a load-balancing pressure, a few experts win early,
// get all the gradient, and the rest starve. The dashed line is the ideal
// uniform share (1/8 = 12.5%). Animated so the redistribution is visible.

const EXPERTS = 8
const COLORS = Array.from(
  { length: EXPERTS },
  (_, i) => `oklch(0.72 0.13 ${(i * 45) % 360})`
)
const IDEAL = 100 / EXPERTS

// load distributions (% of tokens) — must each sum to ~100
const BALANCED = [12, 13, 11, 14, 12, 13, 12, 13]
const COLLAPSED = [34, 3, 27, 2, 2, 22, 8, 2]

export function MoeLoadBalance() {
  const [collapsed, setCollapsed] = useState(false)
  const load = collapsed ? COLLAPSED : BALANCED
  const max = Math.max(...COLLAPSED) // fixed scale so the toggle is honest

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">expert load distribution</span>
        <div className="flex gap-1">
          {[
            { v: false, label: "balanced" },
            { v: true, label: "collapsed" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setCollapsed(o.v)}
              aria-pressed={collapsed === o.v}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                collapsed === o.v
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-6 pb-3">
        <div className="relative flex items-end gap-2 sm:gap-3" style={{ height: 180 }}>
          {/* ideal share line */}
          <div
            className="absolute right-0 left-0 border-t border-dashed border-foreground/40"
            style={{ bottom: `${(IDEAL / max) * 100}%` }}
          >
            <span className="absolute -top-4 right-0 font-mono text-[10px] text-muted-foreground">
              ideal 12.5%
            </span>
          </div>

          {load.map((c, e) => (
            <div key={e} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {c}%
              </span>
              <div
                className="w-full rounded-t-sm transition-all duration-700 ease-out"
                style={{ height: `${(c / max) * 100}%`, background: COLORS[e] }}
              />
              <span className="font-mono text-[10px] text-muted-foreground">E{e}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        {collapsed ? (
          <>
            Three experts swallow ~83% of the tokens; four are all but dead. Those
            experts get almost no gradient, never improve, and the model is quietly
            a fraction of its advertised size. This is the failure mode you fight.
          </>
        ) : (
          <>
            Every expert sees a fair share, so all of them keep learning. Getting
            here is not free — it takes the routing noise plus an auxiliary
            load-balancing loss that penalises lopsided routing during training.
          </>
        )}
      </p>
    </figure>
  )
}

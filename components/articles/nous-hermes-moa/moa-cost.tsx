"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// MoA's quality is bought with compute. Depth L and width n set the model-call
// budget — n proposers per layer across L layers, plus the final aggregator —
// while quality climbs with diminishing returns and latency grows with depth.
// Drag both and watch the trade. The quality curve is an illustrative stand-in
// (saturating in both L and n), not a measured surface.

function quality(L: number, n: number) {
  // base single-model ~57; gains saturate in depth and width
  const widthGain = 10 * (1 - Math.exp(-(n - 1) / 2.2))
  const depthGain = 8 * (1 - Math.exp(-L / 1.6))
  return Math.min(72, 57 + widthGain + depthGain * (n > 1 ? 1 : 0))
}

export function MoACost() {
  const [L, setL] = useState(2)
  const [n, setN] = useState(4)

  const calls = L * n + 1 // proposers across layers + final aggregator
  const q = quality(L, n)
  const latency = L + 1 // sequential layers + aggregate step (relative units)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        cost vs quality · depth L × width n
      </div>

      <div className="space-y-4 p-4">
        {/* mini layered preview */}
        <div className="space-y-1.5">
          {Array.from({ length: L }).map((_, li) => (
            <div key={li} className="flex items-center gap-1.5">
              <span className="w-12 shrink-0 font-mono text-[10px] text-muted-foreground">
                L{li + 1}
              </span>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: n }).map((_, pi) => (
                  <span
                    key={pi}
                    className="size-3.5 rounded-sm"
                    style={{ background: `oklch(0.72 0.13 ${130 + pi * 26})`, opacity: 0.85 }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-12 shrink-0 font-mono text-[10px] text-muted-foreground">agg</span>
            <span className="size-3.5 rounded-sm border border-foreground/40" />
          </div>
        </div>

        {/* sliders */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>layers L</span>
              <span className="text-foreground tabular-nums">{L}</span>
            </div>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={L}
              onChange={(e) => setL(parseInt(e.target.value))}
              className="w-full cursor-pointer accent-foreground"
              aria-label="number of layers"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>proposers n</span>
              <span className="text-foreground tabular-nums">{n}</span>
            </div>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={n}
              onChange={(e) => setN(parseInt(e.target.value))}
              className="w-full cursor-pointer accent-foreground"
              aria-label="proposers per layer"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="model calls" value={`${calls}`} />
          <Stat label="latency (depth)" value={`${latency}×`} />
          <Stat label="quality (stand-in)" value={`${q.toFixed(1)}%`} highlight />
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {n === 1
            ? "With a single proposer there's nothing to aggregate — you're back to one model. Width is where collaborativeness lives."
            : calls >= 13
              ? "Deep and wide buys the top of the quality curve, but you're paying ~" +
                calls +
                " model calls and " +
                latency +
                "× the depth-latency per answer. Past here the curve is nearly flat — diminishing returns."
              : "A shallow, wide stack captures most of the gain cheaply: a couple of layers and a handful of diverse proposers. Quality saturates fast, so more depth mostly costs latency."}
        </p>
      </div>
    </figure>
  )
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("font-medium", highlight ? "text-foreground" : "text-foreground")}>
        {value}
      </div>
    </div>
  )
}

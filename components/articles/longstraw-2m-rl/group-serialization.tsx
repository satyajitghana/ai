"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Why serial response replay is the whole trick. GRPO samples G responses for
// one long prompt. Hold all G response graphs live and activation memory scales
// with G — at a 2M-token context that blows the GPU budget. LongStraw replays
// one response at a time, so G becomes a *scheduling* dimension, not a memory
// multiplier. The measured Qwen numbers: peak per rank moves only 97.503 →
// 97.711 GB as G goes 2 → 8 (+0.208 GB). The "hold all graphs" curve is
// illustrative — it is precisely the path LongStraw avoids.

const OK = "oklch(0.64 0.15 155)"
const BAD = "oklch(0.62 0.19 25)"
const CEIL = 150.755 // H20-3e usable, GB per rank (paper)
const P2 = 97.503 // measured peak at G=2 (GB/rank)
const SLOPE = (97.711 - 97.503) / (8 - 2) // measured serial slope per G

export function GroupSerialization() {
  const [g, setG] = useState(8)

  const serial = P2 + SLOPE * (g - 2)
  // illustrative counterfactual: holding all G response graphs scales activation with G
  const holdAll = P2 + 11 * (g - 2)
  const oom = holdAll > CEIL

  const bar = (label: string, gb: number, color: string, over: boolean, tag?: string) => (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
        <span>
          {label}
          {tag ? <span className="ml-1 rounded bg-muted/60 px-1 py-px text-[9px]">{tag}</span> : null}
        </span>
        <span className="tabular-nums" style={{ color: over ? BAD : color }}>
          {over ? "OOM · " : ""}
          {gb.toFixed(gb < 100 ? 3 : 1)} GB
        </span>
      </div>
      <div className="relative h-8 w-full overflow-hidden rounded-md bg-muted/30">
        <div
          className="h-full rounded-md transition-[width] duration-150"
          style={{ width: `${Math.min(100, (gb / CEIL) * 100)}%`, background: color, opacity: over ? 0.55 : 1 }}
        />
      </div>
    </div>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        peak memory per rank vs. group size G · Qwen3.6-27B · 2,097,152 positions · 8× H20
      </div>
      <div className="p-3 sm:p-4">
        <div className="space-y-3">
          {bar(`serial replay (LongStraw) — one response graph live at a time`, serial, OK, false, "measured")}
          {bar(`hold all G response graphs — activation scales with G`, holdAll, BAD, oom, "illustrative")}
        </div>

        {/* ceiling note */}
        <div className="mt-2 text-right font-mono text-[10px] text-muted-foreground">
          dashed full bar = H20 ceiling · {CEIL} GB/rank
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">serial peak @ G={g}</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: OK }}>{serial.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">Δ from G=2</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">+{(serial - P2).toFixed(3)}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">headroom to ceiling</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{(CEIL - serial).toFixed(1)}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>G — responses sampled per prompt</span>
            <span className="tabular-nums text-foreground">{g}</span>
          </div>
          <Range
            min={1}
            max={8}
            step={1}
            value={g}
            onChange={(e) => setG(+e.target.value)}
            className="w-full"
            aria-label="group size G"
            accent={OK}
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Serial replay bounds the live autograd graph to a <span style={{ color: OK }}>single response</span>,
          so going from G=2 to G=8 costs only the measured <span className="text-foreground">+0.208 GB</span> —
          group size turns into a time cost, not a memory one. Holding every response graph would scale
          activation memory with G and run past the budget (the <span style={{ color: BAD }}>illustrative</span>{" "}
          curve). That is the point: <span className="text-foreground">G is a schedule, not a multiplier.</span>
        </p>
      </div>
    </figure>
  )
}

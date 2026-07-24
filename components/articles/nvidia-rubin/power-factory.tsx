"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Rubin's efficiency framing: the AI factory is a fixed power budget, and the
// win is useful tokens per watt. DSX MaxLPS recovers stranded power to fit up
// to 40% more GPUs in the same envelope; Intelligent Power Smoothing shaves
// average and peak draw. The base count is illustrative and set by the slider;
// the +40%, −10%, −20% figures are the post's. Drag the factory size.

const ACCENT = "oklch(0.7 0.17 145)"
const EXTRA = "oklch(0.62 0.16 145)"

export function PowerFactory() {
  const [base, setBase] = useState(50)
  const [dsx, setDsx] = useState(true)
  const extra = dsx ? Math.round(base * 0.4) : 0
  const total = base + extra
  const cols = 20

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">same power budget · useful GPUs</span>
        <button
          type="button"
          onClick={() => setDsx((d) => !d)}
          className="flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-xs transition-colors hover:bg-muted/50"
        >
          DSX MaxLPS:
          <span className="rounded px-1.5 py-0.5 tabular-nums" style={dsx ? { background: ACCENT, color: "black" } : { background: "var(--muted)", color: "var(--muted-foreground)" }}>
            {dsx ? "on" : "off"}
          </span>
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-[3px]">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className="h-3 w-3 rounded-[2px] transition-colors"
              style={{ background: i < base ? ACCENT : EXTRA, opacity: i < base ? 1 : 0.85 }}
              title={i < base ? "GPU" : "recovered from stranded power"}
            />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">baseline GPUs</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{base}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">recovered (DSX)</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: ACCENT }}>+{extra}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">total useful GPUs</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{total}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>factory size (baseline GPU slots)</span>
            <span className="tabular-nums text-foreground">{base}</span>
          </div>
          <Range min={10} max={100} step={5} value={base} onChange={(e) => setBase(+e.target.value)} className="w-full" aria-label="factory size" accent={ACCENT} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Same megawatts in the door. Intelligent Power Smoothing trims <span style={{ color: ACCENT }}>~10%</span>{" "}
          off average draw and <span style={{ color: ACCENT }}>~20%</span> off 50 ms peaks, and DSX MaxLPS turns that
          reclaimed headroom into up to <span style={{ color: ACCENT }}>40% more GPUs</span> — the AI-factory version
          of performance per watt.
        </p>
      </div>
    </figure>
  )
}

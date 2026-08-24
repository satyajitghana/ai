"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Chimera's mechanistic RoPE audit, drawn as a re-assignment diagram. RoPE
// bundles three separate inductive biases into the same rotated Q/K channels
// (they compete for the same capacity); Chimera un-bundles them into three
// dedicated, non-attention modules. Toggle a bias and watch its connector
// light up on both sides, with the paper's own numbers underneath.

type Bias = "position" | "decay" | "layout"

const COLOR: Record<Bias, string> = {
  position: "oklch(0.62 0.16 30)",
  decay: "oklch(0.58 0.15 265)",
  layout: "oklch(0.62 0.13 155)",
}

const LEFT_LABEL: Record<Bias, string> = {
  position: "position selection",
  decay: "recency decay",
  layout: "layout encoding",
}

const RIGHT_LABEL: Record<Bias, string> = {
  position: "modality-aware short conv",
  decay: "KDA forget gate αₜ",
  layout: "conv's native 1D / 3D grid",
}

const STAT: Record<Bias, string> = {
  position:
    "Qwen3-4B, best offset-n head: 0.56 of queries peak at n = 2, only 0.07 at n = 10 — short range only. Same split found in FLUX.2 and Wan2.2.",
  decay:
    "RoPE's decay is an implicit average over summed rotations — a trained head can bypass it. KDA's αₜ is an explicit, per-channel, content-adaptive gate: a learned half-life, not a side effect.",
  layout:
    "RoPE hand-partitions channels across axes at design time; more axes means less frequency resolution each. The convolution is natively 1D for text and 3D (causal in time) for video — no channels spent partitioning.",
}

const BIASES: Bias[] = ["position", "decay", "layout"]

const W = 740
const H = 300
const LX = 40
const LW = 230
const RX = 468
const RW = 232
const TOP = 46
const BANDH = 66
const GAP = 12
const BOXH = BANDH - GAP

const bandY = (i: number) => TOP + i * BANDH

export function RopeUnbundling() {
  const [bias, setBias] = useState<Bias>("position")

  const curve = (y1: number, y2: number) => {
    const x1 = LX + LW
    const x2 = RX
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        rope&rsquo;s three biases, re-assigned to dedicated modules
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Diagram: RoPE bundles position selection, recency decay, and layout encoding into rotated query-key channels. Chimera assigns each to its own module: ${RIGHT_LABEL.position}, ${RIGHT_LABEL.decay}, and ${RIGHT_LABEL.layout}. Currently highlighted: ${LEFT_LABEL[bias]}.`}
        >
          <defs>
            {BIASES.map((b) => (
              <marker
                key={b}
                id={`rope-arrow-${b}`}
                viewBox="0 -5 10 10"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
                refX="7"
                refY="0"
              >
                <path d="M0,-4L6,0L0,4" fill="none" stroke={COLOR[b]} strokeWidth={1.5} />
              </marker>
            ))}
            <filter id="rope-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* column headers */}
          <text x={LX} y={26} className="fill-muted-foreground font-mono" fontSize={11}>
            RoPE · one shared channel budget
          </text>
          <text x={RX} y={26} className="fill-muted-foreground font-mono" fontSize={11}>
            Chimera · one module each
          </text>

          {/* left: single bundle box, divided into 3 bands */}
          <rect
            x={LX}
            y={TOP - 6}
            width={LW}
            height={BANDH * 3 + 6}
            rx={10}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
          {BIASES.map((b, i) => {
            const active = b === bias
            return (
              <g key={b} onClick={() => setBias(b)} className="cursor-pointer">
                <rect
                  x={LX + 6}
                  y={bandY(i)}
                  width={LW - 12}
                  height={BOXH}
                  rx={7}
                  fill={COLOR[b]}
                  opacity={active ? 0.16 : 0.06}
                  stroke={active ? COLOR[b] : "transparent"}
                  strokeWidth={1.5}
                  filter={active ? "url(#rope-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <text
                  x={LX + 18}
                  y={bandY(i) + BOXH / 2 + 4}
                  className="font-mono"
                  fontSize={12}
                  fontWeight={active ? 600 : 400}
                  fill={active ? "var(--foreground)" : "var(--muted-foreground)"}
                >
                  {LEFT_LABEL[b]}
                </text>
              </g>
            )
          })}

          {/* connectors */}
          {BIASES.map((b, i) => {
            const active = b === bias
            const y = bandY(i) + BOXH / 2
            return (
              <path
                key={b}
                d={curve(y, y)}
                fill="none"
                stroke={COLOR[b]}
                strokeWidth={active ? 2 : 1.2}
                opacity={active ? 0.95 : 0.25}
                markerEnd={`url(#rope-arrow-${b})`}
                className="transition-all duration-300"
              />
            )
          })}

          {/* right: three dedicated modules */}
          {BIASES.map((b, i) => {
            const active = b === bias
            const y = bandY(i) + BOXH / 2
            return (
              <g key={b} onClick={() => setBias(b)} className="cursor-pointer">
                <rect
                  x={RX}
                  y={y - BOXH / 2}
                  width={RW}
                  height={BOXH}
                  rx={8}
                  fill="var(--background)"
                  stroke={active ? COLOR[b] : "var(--border)"}
                  strokeWidth={1.5}
                  filter={active ? "url(#rope-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <text
                  x={RX + RW / 2}
                  y={y + 4}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={11.5}
                  fontWeight={active ? 600 : 400}
                  fill={active ? "var(--foreground)" : "var(--muted-foreground)"}
                >
                  {RIGHT_LABEL[b]}
                </text>
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {BIASES.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBias(b)}
              aria-pressed={bias === b}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                bias === b ? "border-transparent text-background" : "text-muted-foreground hover:text-foreground"
              )}
              style={bias === b ? { background: COLOR[b] } : undefined}
            >
              {LEFT_LABEL[b]}
            </button>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">{STAT[bias]}</p>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Freed of all three jobs, attention (MLA) is left to do only content matching — the paper&rsquo;s own framing is
          that MLA without RoPE is the limiting case where every channel has zero rotary frequency. Nothing here is
          tied to a training length, which is the mechanistic reason extrapolation works at all.
        </p>
      </div>
    </figure>
  )
}

"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The footprint collapse. Bonsai quantizes a 54 GB FP16 Qwen3.6-27B end-to-end
// to ternary (1.71 effective bits/weight, 5.9 GB) or 1-bit (1.125 bits, 3.9 GB) —
// small enough to sit inside a phone's app-memory budget. Flip the precision and
// watch the weight encoding and the memory bar cross the ~6 GB phone line. Sizes
// are PrismML's reported figures.

const SMALL = "oklch(0.64 0.15 150)" // fits on device
const BIG = "oklch(0.62 0.19 25)" // far over budget

type Mode = "fp16" | "ternary" | "onebit"
const MODES: {
  id: Mode
  label: string
  bits: number
  gb: number
  enc: string
}[] = [
  { id: "fp16", label: "FP16", bits: 16, gb: 54, enc: "16-bit float weights" },
  { id: "ternary", label: "Ternary", bits: 1.71, gb: 5.9, enc: "weights in {−1, 0, +1} + FP16 group scale" },
  { id: "onebit", label: "1-bit", bits: 1.125, gb: 3.9, enc: "weights in {−1, +1} + group scale" },
]
const PHONE = 6 // ~GB app-memory budget (iPhone 17 Pro)

const W = 760
const H = 176
const BX = 132
const MX = 34
const BW = W - BX - MX
const MAXGB = 54
const barW = (gb: number) => Math.max((gb / MAXGB) * BW, 2)

export function Footprint() {
  const [mode, setMode] = useState<Mode>("onebit")
  const rows = MODES
  const phoneX = BX + barW(PHONE)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>weight footprint · Qwen3.6-27B, end to end</span>
        <span className="text-muted-foreground/50">PrismML figures</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Model size in gigabytes at FP16, ternary, and 1-bit, against a phone app-memory budget of about 6 GB">
          <defs>
            <filter id="bf-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* phone budget line */}
          <line x1={phoneX} x2={phoneX} y1={22} y2={H - 26} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" />
          <text x={phoneX + 5} y={30} className="fill-muted-foreground font-mono" fontSize={9}>~6 GB phone budget</text>

          {rows.map((r, i) => {
            const y = 42 + i * 40
            const active = r.id === mode
            const fits = r.gb <= PHONE
            const color = fits ? SMALL : BIG
            return (
              <g key={r.id} opacity={active ? 1 : 0.55} className="transition-all">
                <text x={BX - 12} y={y + 17} textAnchor="end" className="fill-foreground font-mono" fontSize={12} fontWeight={active ? 700 : 500}>
                  {r.label}
                </text>
                <rect x={BX} y={y} width={BW} height={26} rx={6} fill="var(--muted)" opacity={0.3} />
                <rect x={BX} y={y} width={barW(r.gb)} height={26} rx={6} fill={color} filter={active ? "url(#bf-soft)" : undefined} className="transition-all" />
                <text x={BX + barW(r.gb) + (r.gb > 40 ? -8 : 8)} y={y + 17} textAnchor={r.gb > 40 ? "end" : "start"} className="font-mono" fontSize={11} fontWeight={600} fill={r.gb > 40 ? "var(--background)" : "var(--foreground)"}>
                  {r.gb} GB
                </text>
              </g>
            )
          })}
        </svg>

        {/* precision control */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-muted-foreground">precision</span>
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setMode(r.id)}
              aria-pressed={mode === r.id}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                mode === r.id ? "border-foreground/40 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
          <span className="ml-auto font-mono text-[11px] text-foreground tabular-nums">
            {MODES.find((x) => x.id === mode)!.bits} bits/weight
          </span>
        </div>

        <div className="mt-3 rounded-md bg-muted/40 px-3 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
          <span className="text-foreground">{MODES.find((x) => x.id === mode)!.label}:</span>{" "}
          {MODES.find((x) => x.id === mode)!.enc} ·{" "}
          <span className="text-foreground">{MODES.find((x) => x.id === mode)!.gb} GB</span>
          {mode !== "fp16" ? (
            <> · {(54 / MODES.find((x) => x.id === mode)!.gb).toFixed(1)}× smaller than FP16</>
          ) : (
            <> · does not fit a phone (≈9× over budget)</>
          )}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The same 27B weights, re-encoded. Ternary spends{" "}
          <span className="text-foreground">1.71 bits</span> each ({" "}
          <span className="font-mono">{"{−1, 0, +1}"}</span> plus an FP16 per-group scale), the
          1-bit variant just <span className="text-foreground">1.125</span> ({" "}
          <span className="font-mono">{"{−1, +1}"}</span> plus a scale) — collapsing a 54 GB model to
          3.9 GB, small enough to live inside a phone&apos;s app-memory budget. The capability is
          still Qwen3.6-27B&apos;s; what changes is whether it fits.
        </p>
      </div>
    </figure>
  )
}

"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Weights memory is just params × bytes-per-param, and inference doesn't need
// training precision. Pick a model size and a precision: the top scene shows the
// bit layout of one weight (sign / exponent / mantissa for floats, packed bits for
// ints), the bottom scene drops the footprint onto a VRAM axis so you can see which
// GPUs it clears. INT4 is why a 7B model runs on a 6 GB laptop GPU. Numbers match
// the article's: 7B is 28 / 14 / 7 / 3.5 GB at FP32 / FP16 / INT8 / INT4.

type Field = { n: number; op: number; label: string }
type Prec = { id: string; label: string; bytes: number; note: string; fields: Field[]; layout: string }

const PRECISIONS: Prec[] = [
  { id: "fp32", label: "FP32", bytes: 4, note: "training precision", layout: "1 sign · 8 exponent · 23 mantissa", fields: [{ n: 1, op: 1, label: "sign" }, { n: 8, op: 0.66, label: "exp" }, { n: 23, op: 0.4, label: "mantissa" }] },
  { id: "fp16", label: "FP16", bytes: 2, note: "standard inference", layout: "1 sign · 5 exponent · 10 mantissa", fields: [{ n: 1, op: 1, label: "sign" }, { n: 5, op: 0.66, label: "exp" }, { n: 10, op: 0.4, label: "mantissa" }] },
  { id: "int8", label: "INT8", bytes: 1, note: "~half latency, ~no quality loss", layout: "8-bit integer + per-channel scale", fields: [{ n: 8, op: 0.85, label: "int8" }] },
  { id: "int4", label: "INT4", bytes: 0.5, note: "within 1–2 pts (GPTQ / AWQ)", layout: "4-bit integer + per-channel scale", fields: [{ n: 4, op: 0.85, label: "int4" }] },
]
const SIZES = [7, 13, 70]
const GPUS = [
  { name: "laptop", vram: 6 },
  { name: "RTX 4090", vram: 24 },
  { name: "A100", vram: 40 },
  { name: "H100", vram: 80 },
]

const ACC = "oklch(0.72 0.15 195)"
const FIT = "oklch(0.68 0.15 150)"
const OVER = "oklch(0.7 0.15 25)"

// bit-layout geometry
const BW = 600
const NBITS = 32
const BX0 = 14
const CELLP = (BW - 2 * BX0) / NBITS

// vram axis geometry
const VW = 600
const VX0 = 14
const VX1 = 586
const VMAX = 80

export function Quantization() {
  const [size, setSize] = useState(7)
  const [prec, setPrec] = useState("int4")
  const p = PRECISIONS.find((x) => x.id === prec)!
  const gb = size * p.bytes // params(B) × bytes → GB (1e9 base)
  const bitsUsed = p.fields.reduce((s, f) => s + f.n, 0)

  const sx = (g: number) => VX0 + Math.min(1, g / VMAX) * (VX1 - VX0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        weights memory · params × bytes-per-param
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        {/* controls */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">model</span>
            {SIZES.map((s) => (
              <button key={s} type="button" onClick={() => setSize(s)} aria-pressed={size === s}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", size === s ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {s}B
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">precision</span>
            {PRECISIONS.map((x) => (
              <button key={x.id} type="button" onClick={() => setPrec(x.id)} aria-pressed={prec === x.id}
                className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors", prec === x.id ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
                style={prec === x.id ? { background: ACC } : undefined}>
                {x.label}
              </button>
            ))}
          </div>
        </div>

        {/* bit layout */}
        <svg viewBox={`0 0 ${BW} 84`} className="w-full" role="img" aria-label={`${p.label} uses ${bitsUsed} bits per weight: ${p.layout}`}>
          {Array.from({ length: NBITS }, (_, i) => {
            // find which field this bit belongs to
            let acc = 0
            let field: Field | null = null
            for (const f of p.fields) { if (i >= acc && i < acc + f.n) { field = f; break } acc += f.n }
            return (
              <rect key={i} x={BX0 + i * CELLP + 1} y={20} width={CELLP - 2} height={26} rx={2.5}
                fill={field ? ACC : "var(--muted)"} opacity={field ? field.op : 0.3}
                stroke={field ? "none" : "var(--border)"} strokeWidth={0.75} className="transition-all duration-300" />
            )
          })}
          {/* used-bits bracket */}
          <line x1={BX0} y1={54} x2={BX0 + bitsUsed * CELLP} y2={54} stroke={ACC} strokeWidth={1.25} />
          <text x={BX0} y={14} className="fill-muted-foreground font-mono" fontSize={10}>{bitsUsed} bits / weight</text>
          <text x={BX0} y={70} className="fill-muted-foreground/80 font-mono" fontSize={10}>{p.layout}</text>
          <text x={BW - BX0} y={14} textAnchor="end" className="fill-muted-foreground/50 font-mono" fontSize={9}>32-bit slot</text>
        </svg>

        {/* memory readout */}
        <div className="flex items-baseline justify-between rounded-lg border bg-muted/20 px-3 py-2.5">
          <div>
            <div className="font-mono text-xs text-muted-foreground">{size}B · {p.label}</div>
            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{p.note}</div>
          </div>
          <span className="font-mono text-2xl font-medium tabular-nums" style={{ color: ACC }}>{gb.toFixed(1)} GB</span>
        </div>

        {/* vram fit axis */}
        <div>
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">fits in VRAM (weights only)</div>
          <svg viewBox={`0 0 ${VW} 96`} className="w-full" role="img" aria-label={`${gb.toFixed(1)} GB footprint against GPU VRAM: ${GPUS.filter((g) => gb <= g.vram).map((g) => g.name).join(", ") || "none"} fit`}>
            {/* axis */}
            <line x1={VX0} y1={58} x2={VX1} y2={58} stroke="var(--border)" strokeWidth={1} />
            {/* footprint bar */}
            <rect x={VX0} y={48} width={sx(gb) - VX0} height={20} rx={4} fill={ACC} opacity={0.9} className="transition-all duration-300" />
            <text x={Math.min(sx(gb) + 6, VW - 40)} y={62} className="fill-foreground font-mono tabular-nums" fontSize={11} fontWeight={600}>{gb.toFixed(1)} GB</text>
            {/* gpu thresholds */}
            {GPUS.map((g) => {
              const fits = gb <= g.vram
              const x = sx(g.vram)
              return (
                <g key={g.name}>
                  <line x1={x} y1={30} x2={x} y2={72} stroke={fits ? FIT : OVER} strokeWidth={1.25} strokeDasharray="3 3" opacity={fits ? 0.9 : 0.5} />
                  <circle cx={x} cy={30} r={3} fill={fits ? FIT : OVER} opacity={fits ? 1 : 0.5} />
                  <text x={x} y={20} textAnchor="middle" className="font-mono" fontSize={9} fill={fits ? FIT : "var(--muted-foreground)"} opacity={fits ? 1 : 0.6}>{g.name}</text>
                  <text x={x} y={86} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>{g.vram}GB</text>
                </g>
              )
            })}
          </svg>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          The savings are linear in bit-width, and inference quality barely moves:
          INT8 typically costs nothing and roughly halves latency, while INT4 lands within
          1–2 points of full precision using per-channel scaling (GPTQ, AWQ). That&rsquo;s
          why quantization is usually the highest-leverage single change for a deployment —
          and why a {size}B model at INT4 ({(size * 0.5).toFixed(1)} GB) fits where its
          FP16 form ({size * 2} GB) wouldn&rsquo;t.
        </p>
      </div>
    </figure>
  )
}

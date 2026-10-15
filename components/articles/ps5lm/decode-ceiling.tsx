"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Decode ceiling for Qwen3.8-27B, batch 1:
//
//   tok/s ≤ B / R          B  memory bandwidth, GB/s
//                          R  bytes read per generated token, GB
//
// R is measured: the tensor table of each Unsloth GGUF, read from its header,
// minus the token-embedding table (one row per token is read, not the table)
// and minus the MTP block (llama.cpp does not run it here). The KV cache and
// the DeltaNet state add a little on top; at a few thousand tokens of context
// they are under 1% of R, so they are left out.
//
// Bandwidths are the vendors' published peak figures (reported). Capacity is
// what a model may occupy: for the PS5 that is the 11.44 GiB Vulkan heap
// PS5LM's app reports, not the 16 GB on the box.
//
// The two PS5 points are PS5LM Plus's README table (reported).

type Quant = { key: string; label: string; read: number; file: number }

const QUANTS: Quant[] = [
  { key: "iq2", label: "UD-IQ2_XXS", read: 6.838, file: 7.266 },
  { key: "q2k", label: "UD-Q2_K_XL", read: 9.358, file: 9.829 },
  { key: "q4", label: "UD-Q4_K_M", read: 15.695, file: 16.464 },
  { key: "q5", label: "UD-Q5_K_M", read: 19.002, file: 19.772 },
  { key: "q8", label: "Q8_0", read: 27.629, file: 29.047 },
]

type Device = { key: string; label: string; bw: number; cap: number; capLabel: string }

const DEVICES: Device[] = [
  { key: "spark", label: "DGX Spark", bw: 273, cap: 128, capLabel: "128 GB" },
  { key: "4060", label: "RTX 4060 Ti 16 GB", bw: 288, cap: 16, capLabel: "16 GB" },
  { key: "ps5", label: "PS5 GPU", bw: 448, cap: 12.28, capLabel: "11.44 GiB heap" },
  { key: "m4", label: "M4 Max", bw: 546, cap: 128, capLabel: "up to 128 GB" },
  { key: "4090", label: "RTX 4090", bw: 1008, cap: 24, capLabel: "24 GB" },
  { key: "5090", label: "RTX 5090", bw: 1792, cap: 32, capLabel: "32 GB" },
]

const REPORTED: Record<string, number> = { iq2: 20.7, q2k: 20.3 }

const ROOF = "oklch(0.62 0.13 250)"
const EFF = "oklch(0.50 0.15 250)"
const HIT = "oklch(0.60 0.19 30)"

const W = 720
const ROW = 34
const PL = 150
const PR = 70
const PT = 26

function niceMax(v: number) {
  for (const s of [40, 80, 120, 160, 200, 280, 400]) if (v <= s) return s
  return 400
}

export function DecodeCeiling() {
  const [qk, setQk] = useState("iq2")
  const [eff, setEff] = useState(42)
  const q = QUANTS.find((x) => x.key === qk) ?? QUANTS[0]

  const rows = DEVICES.map((d) => {
    const roof = d.bw / q.read
    return { ...d, roof, at: (roof * eff) / 100, fits: q.file <= d.cap }
  })
  const max = niceMax(Math.max(...rows.map((r) => (r.fits ? r.roof : 0)), 30) * 1.05)
  const PW = W - PL - PR
  const H = PT + rows.length * ROW + 30
  const x = (v: number) => PL + (Math.min(v, max) / max) * PW
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)

  const ps5 = rows.find((r) => r.key === "ps5")
  const rep = REPORTED[q.key]
  const implied = rep && ps5 ? (rep / ps5.roof) * 100 : null

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Qwen3.8-27B decode ceiling = bandwidth ÷ bytes per token · reasoned from measured GGUF
        sizes and published bandwidths
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
        {QUANTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setQk(s.key)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              s.key === qk
                ? "border-foreground/40 bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="px-2 pt-3 sm:px-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Decode ceilings for Qwen3.8-27B at ${q.label}, which reads ${q.read.toFixed(2)} GB per token. The PS5 GPU at 448 GB/s has a ceiling of ${ps5 ? ps5.roof.toFixed(1) : ""} tokens per second.`}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={x(v)}
                y1={PT - 6}
                x2={x(v)}
                y2={PT + rows.length * ROW}
                stroke="var(--border)"
                strokeDasharray={v === 0 ? undefined : "2 4"}
              />
              <text
                x={x(v)}
                y={PT + rows.length * ROW + 14}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={10}
              >
                {v.toFixed(0)}
              </text>
            </g>
          ))}
          <text
            x={PL + PW / 2}
            y={H - 2}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            tokens per second
          </text>

          {rows.map((r, i) => {
            const y = PT + i * ROW
            return (
              <g key={r.key}>
                <text x={PL - 10} y={y + 13} textAnchor="end" className="fill-foreground font-mono" fontSize={11}>
                  {r.label}
                </text>
                <text x={PL - 10} y={y + 25} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                  {r.bw} GB/s · {r.capLabel}
                </text>
                {r.fits ? (
                  <g>
                    <rect x={PL} y={y + 4} width={x(r.roof) - PL} height={20} rx={3} fill={ROOF} fillOpacity={0.3} />
                    <rect x={PL} y={y + 4} width={x(r.at) - PL} height={20} rx={3} fill={EFF} fillOpacity={0.85} />
                    <text x={x(r.roof) + 6} y={y + 18} className="fill-foreground font-mono" fontSize={10}>
                      {r.roof.toFixed(1)}
                    </text>
                  </g>
                ) : (
                  <text x={PL + 6} y={y + 18} className="fill-muted-foreground font-mono" fontSize={10}>
                    {q.file.toFixed(1)} GB file does not fit
                  </text>
                )}
                {r.key === "ps5" && rep && r.fits ? (
                  <g>
                    <line x1={x(rep)} y1={y} x2={x(rep)} y2={y + 28} stroke={HIT} strokeWidth={2} />
                    <text x={x(rep)} y={y - 2} textAnchor="middle" fontSize={9.5} fill={HIT} className="font-mono">
                      reported {rep}
                    </text>
                  </g>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="border-t px-4 py-3">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-40 shrink-0 font-mono text-muted-foreground">bandwidth actually used</span>
          <Range min={10} max={100} step={1} value={eff} onChange={(e) => setEff(Number(e.target.value))} aria-label="Share of peak bandwidth actually used" />
          <span className="w-12 shrink-0 text-right font-mono tabular-nums">{eff}%</span>
        </label>
        <div className="mt-2 font-mono text-[11px] text-muted-foreground">
          {q.label}: {q.read.toFixed(2)} GB read per token, {q.file.toFixed(2)} GB file.{" "}
          {implied !== null ? (
            <span>
              The PS5&rsquo;s reported {rep} tok/s is{" "}
              <span className="text-foreground">{implied.toFixed(0)}% of its ceiling</span>.
            </span>
          ) : (
            <span>PS5LM reports no run of this quant; it does not fit the PS5&rsquo;s heap at Q4 and above.</span>
          )}
        </div>
      </div>
      <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Pale bar: the ceiling at peak bandwidth. Dark bar: the same ceiling at the share set by the
        slider. Real decoders sit below the pale bar: kernels, dequantisation and launch overhead
        all cost time that bytes do not account for. Capacity for Apple and DGX parts is the
        largest configuration.
      </p>
    </figure>
  )
}

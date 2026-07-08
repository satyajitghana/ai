"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The one structural edit in a6b-k-expansion: raise the MoE router's top-k from 8
// to 32. The router scores all 256 experts, keeps top-k, and *renormalizes the
// selected gate weights so they sum to 1*. That renormalization is the whole story:
// adding experts does not just append them — it silently redistributes the entire
// gate mass across k slots, shrinking every existing expert's weight and handing the
// difference to newcomers the model never trained to co-activate.
//
// RAW = router softmax mass on the top-32 ranked experts (rank-1 normalized to 1.0),
// a decaying profile tuned so the renormalized ranks 9-32 carry 54.0% of the mass at
// k=32 — the exact "untrained tail" figure the repo profiled. Fully deterministic:
// no randomness, no timers, safe to prerender on the server.

const RAW = [
  1.0, 0.6853, 0.5493, 0.4696, 0.4158, 0.3764, 0.3461, 0.3218, 0.3018, 0.2849,
  0.2705, 0.2579, 0.2469, 0.2371, 0.2284, 0.2205, 0.2133, 0.2068, 0.2008, 0.1952,
  0.1901, 0.1853, 0.1809, 0.1768, 0.1729, 0.1692, 0.1658, 0.1625, 0.1594, 0.1565,
  0.1537, 0.1511,
] as const

const KS = [8, 16, 24, 32] as const
type K = (typeof KS)[number]

// Measured on the frozen base model (README / METHOD.md k-sweep tables).
const MMLU: Record<K, number> = { 8: 0.8433, 16: 0.8283, 24: 0.815, 32: 0.8067 }
const GSM8K: Record<K, number> = { 8: 0.8933, 16: 0.8883, 24: 0.8783, 32: 0.865 }
// ~3B active at k=8, ~6.6B at k=32 (repo endpoints); 16/24 linearly interpolated.
const ACTIVE: Record<K, string> = { 8: "~3.0B", 16: "≈4.2B", 24: "≈5.4B", 32: "~6.6B" }

const CORE = "oklch(0.62 0.15 250)" // trained top-8 — blue
const TAIL = "oklch(0.70 0.16 55)" // added ranks 9-32 — orange
const OFF = "var(--muted-foreground)"

const N = 32
const W = 760
const H = 250
const MX = 22
const USABLE = W - 2 * MX
const PER = USABLE / N
const BW = 15
const TOP = 26
const BAR_H = 118
const BASE_Y = TOP + BAR_H

// Tallest bar overall = rank-1's renormalized weight at k=8. Scale every bar to it,
// so as k grows you watch every bar shrink — that is renormalization redistributing.
const REF = RAW[0] / RAW.slice(0, 8).reduce((a, b) => a + b, 0)

function weights(k: K) {
  const sum = RAW.slice(0, k).reduce((a, b) => a + b, 0)
  return RAW.map((r, i) => (i < k ? r / sum : 0))
}

export function GateMass() {
  const [k, setK] = useState<K>(32)
  const w = weights(k)
  const core = w.slice(0, 8).reduce((a, b) => a + b, 0)
  const tail = w.slice(8, k).reduce((a, b) => a + b, 0)
  const massY = BASE_Y + 34
  const massH = 20

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>router gate mass · renormalized to top-{k}</span>
        <span className="text-muted-foreground/50">illustrative profile</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${massY + massH + 30}`}
          className="w-full"
          role="img"
          aria-label={`Renormalized router gate weights for the top ${k} of 256 experts. Ranks 1-8 are the trained core; ranks 9-${k} are the untrained tail carrying ${Math.round(tail * 100)} percent of the mass.`}
        >
          {/* bars — one per top-32 expert */}
          {RAW.map((_, i) => {
            const active = i < k
            const isCore = i < 8
            const h = active ? Math.max((w[i] / REF) * BAR_H, 1.5) : 3
            const x = MX + i * PER + (PER - BW) / 2
            const fill = !active ? OFF : isCore ? CORE : TAIL
            return (
              <rect
                key={i}
                x={x}
                y={BASE_Y - h}
                width={BW}
                height={h}
                rx={2}
                fill={fill}
                opacity={active ? 0.95 : 0.14}
                className="transition-all duration-300"
              />
            )
          })}

          {/* baseline */}
          <line x1={MX} y1={BASE_Y} x2={W - MX} y2={BASE_Y} stroke="var(--border)" />

          {/* rank 8 | 9 divider — the trained/untrained boundary */}
          <line
            x1={MX + 8 * PER}
            y1={TOP - 6}
            x2={MX + 8 * PER}
            y2={BASE_Y + 6}
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
          <text x={MX + 8 * PER - 4} y={TOP - 10} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
            rank 8
          </text>
          <text x={MX + 8 * PER + 4} y={TOP - 10} textAnchor="start" className="font-mono" fontSize={9} fill={TAIL}>
            ranks 9-32
          </text>

          {/* rank labels at the ends */}
          <text x={MX} y={BASE_Y + 14} className="fill-muted-foreground font-mono" fontSize={9}>1</text>
          <text x={W - MX} y={BASE_Y + 14} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>256 experts →</text>

          {/* stacked gate-mass bar */}
          <text x={MX} y={massY - 6} className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
            gate mass · sums to 1 after renorm
          </text>
          <rect x={MX} y={massY} width={core * USABLE} height={massH} fill={CORE} rx={2} className="transition-all duration-300" />
          <rect x={MX + core * USABLE} y={massY} width={tail * USABLE} height={massH} fill={TAIL} rx={2} className="transition-all duration-300" />
          <text x={MX + 6} y={massY + massH / 2 + 3.5} className="fill-background font-mono" fontSize={10} fontWeight={600}>
            top-8 · {Math.round(core * 100)}%
          </text>
          {tail > 0.06 ? (
            <text
              x={MX + core * USABLE + 6}
              y={massY + massH / 2 + 3.5}
              className="fill-background font-mono"
              fontSize={10}
              fontWeight={600}
            >
              untrained · {Math.round(tail * 100)}%
            </text>
          ) : null}
        </svg>

        {/* k selector */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">top-k</span>
            {KS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setK(v)}
                aria-pressed={k === v}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                  k === v ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={k === v ? { background: k === 8 ? CORE : TAIL } : undefined}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CORE }} /> trained top-8
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TAIL }} /> untrained tail
            </span>
          </div>
        </div>

        {/* readout — mechanism tied to the measured outcome */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs sm:grid-cols-4">
          <div>
            <div className="text-[10px] text-muted-foreground">active params</div>
            <div className="text-foreground">{ACTIVE[k]}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">untrained mass</div>
            <div style={{ color: TAIL }}>{Math.round(tail * 100)}%</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">MMLU (measured)</div>
            <div className={k === 8 ? "text-foreground" : "text-muted-foreground"}>{MMLU[k].toFixed(4)}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">GSM8K (measured)</div>
            <div className={k === 8 ? "text-foreground" : "text-muted-foreground"}>{GSM8K[k].toFixed(4)}</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The router scores all 256 experts, keeps the top-<span className="text-foreground">{k}</span>, and{" "}
          <em>renormalizes the selected gates to sum to 1</em>. So raising k does not just append experts — it shrinks every
          existing expert&apos;s weight and hands the difference to the newcomers. At k=32 the added{" "}
          <span style={{ color: TAIL }}>ranks 9-32</span> carry <span style={{ color: TAIL }}>54%</span> of the mass, yet the
          model was never trained to co-activate them. Zero new weights are added — only compute. Accuracy falls at every step.
        </p>
      </div>
    </figure>
  )
}

"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Capacity factor and token dropping, drawn as bins. Every expert gets a fixed buffer of
// expert_capacity = (tokens / experts) * capacity_factor slots. Tokens routed to a full
// buffer are DROPPED — they skip the layer and pass through the residual unchanged.
// Raise the capacity factor and drops fall but empty slots (wasted compute/memory) rise;
// skew the load and one expert overflows while others sit half-empty. Deterministic; illustrative.

const OK = "oklch(0.60 0.15 255)" // a processed token
const DROP = "oklch(0.60 0.19 25)" // a dropped token (red)

const NT = 24 // tokens in the batch
const NE = 4 // experts
const BASE = NT / NE // = 6, the balanced load

// deterministic per-expert token counts as load imbalance rises (sum stays = NT)
function counts(imb: number) {
  const uniform = 0.25
  const peak = [0.5, 0.29, 0.17, 0.04] // heavily skewed toward expert 1
  const raw = Array.from({ length: NE }, (_, e) => ((1 - imb) * uniform + imb * peak[e]) * NT)
  const out = raw.map((v) => Math.round(v))
  let sum = 0
  for (let e = 0; e < NE; e++) sum += out[e]
  out[0] += NT - sum // fix rounding drift onto the busiest expert
  return out
}

// scene geometry
const W = 760
const H = 340
const SLOT_H = 13
const COL_W = 46
const BY = 300 // buffer baseline (slot 0 sits just above this)
const xc = (e: number) => 128 + e * 168

const CF_STEPS = [1, 1.25, 1.5, 1.75, 2]

export function CapacityDrop() {
  const [cfIdx, setCfIdx] = useState(0)
  const [imb, setImb] = useState(60)

  const cf = CF_STEPS[cfIdx]
  const cap = Math.ceil(BASE * cf)
  const ct = counts(imb / 100)

  let dropped = 0
  let waste = 0
  for (let e = 0; e < NE; e++) {
    dropped += Math.max(0, ct[e] - cap)
    waste += Math.max(0, cap - ct[e])
  }
  const pctDropped = Math.round((dropped / NT) * 100)
  const pctWaste = Math.round((waste / (cap * NE)) * 100)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>expert buffers · a batch of {NT} tokens</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Four expert buffers each holding ${cap} slots. With capacity factor ${cf} and imbalance ${imb} percent, ${dropped} of ${NT} tokens overflow and are dropped, and ${waste} slots sit empty.`}
        >
          <defs>
            <marker id="cd-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={DROP} strokeWidth={1.5} />
            </marker>
            <filter id="cd-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* residual lane — where dropped tokens go */}
          <line x1={40} y1={30} x2={W - 40} y2={30} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={W - 40} y={24} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
            residual · dropped tokens skip the layer
          </text>

          {Array.from({ length: NE }, (_, e) => {
            const c = ct[e]
            const filled = Math.min(c, cap)
            const over = Math.max(0, c - cap)
            const bufTop = BY - cap * SLOT_H
            const cx = xc(e)
            return (
              <g key={e}>
                {/* buffer outline */}
                <rect x={cx - COL_W / 2} y={bufTop} width={COL_W} height={cap * SLOT_H} rx={5} fill="var(--muted)" opacity={0.35} stroke="var(--border)" strokeWidth={1.5} />

                {/* filled slots */}
                {Array.from({ length: filled }, (_, s) => (
                  <rect key={s} x={cx - COL_W / 2 + 4} y={BY - (s + 1) * SLOT_H + 2} width={COL_W - 8} height={SLOT_H - 3} rx={2.5} fill={OK} opacity={0.85} filter="url(#cd-soft)" />
                ))}

                {/* dropped (overflow) tokens, stacked above the buffer, arrowed to residual */}
                {Array.from({ length: over }, (_, j) => {
                  const dy = bufTop - (j + 1) * SLOT_H - 8
                  return (
                    <g key={`o-${j}`}>
                      <rect x={cx - COL_W / 2 + 4} y={dy} width={COL_W - 8} height={SLOT_H - 3} rx={2.5} fill={DROP} opacity={0.9} />
                      {j === over - 1 && (
                        <path d={`M ${cx} ${dy} C ${cx} ${(dy + 30) / 2}, ${cx} ${(dy + 30) / 2}, ${cx} ${34}`} fill="none" stroke={DROP} strokeWidth={1.5} markerEnd="url(#cd-arrow)" opacity={0.7} />
                      )}
                    </g>
                  )
                })}

                {/* expert label + load readout */}
                <text x={cx} y={BY + 18} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>expert {e + 1}</text>
                <text x={cx} y={BY + 32} textAnchor="middle" className="font-mono" fontSize={9} fill={over > 0 ? DROP : "var(--muted-foreground)"}>
                  {c} routed{over > 0 ? ` · ${over} dropped` : ""}
                </text>
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">capacity factor</span>
            {CF_STEPS.map((v, i) => (
              <button
                key={v}
                type="button"
                onClick={() => setCfIdx(i)}
                aria-pressed={cfIdx === i}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  cfIdx === i ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
                style={cfIdx === i ? { background: OK } : undefined}
              >
                {v.toFixed(2)}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-4 font-mono text-[10px]">
            <span style={{ color: DROP }}>{pctDropped}% dropped</span>
            <span className="text-muted-foreground">{pctWaste}% slots empty</span>
            <span className="text-muted-foreground">buffer = {cap}/expert</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">load imbalance (drag)</div>
          <input type="range" min={0} max={100} value={imb} onChange={(e) => setImb(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.60_0.15_255)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Each expert gets exactly <span className="text-foreground">{cap}</span> slots (buffer = tokens/experts ×
          capacity factor). Under a skewed load the busy expert overflows and those tokens are{" "}
          <span style={{ color: DROP }}>dropped</span> — they pass straight through the residual, unprocessed. Raise the
          capacity factor and drops fall, but the emptier buffers waste compute and memory. That tension is why the
          load-balancing loss matters: flatten the routing and a small buffer suffices.
        </p>
      </div>
    </figure>
  )
}

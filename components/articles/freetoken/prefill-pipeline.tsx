"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Full-layer double buffering, drawn on a time axis.
//
// Prefill routes thousands of tokens through every layer, so it activates nearly
// the whole expert set — a prefill pass streams essentially the entire expert
// pool over PCIe no matter what the router picks. FreeToken therefore stops
// fetching experts on demand and allocates two full-layer buffers out of the same
// slot pool the decode cache uses: while the GPU computes layer l out of one, a
// dedicated transfer stream fills layer l+1 into the other. Loading the whole
// layer is what lets the transfer start before that layer's routing is known.
//
// Let tau be one layer's transfer and c one layer's compute, rho = c/tau:
//
//   overlapped   = L·tau + c        (only the last compute is exposed)
//   serialized   = L·(tau + c)
//   penalty      = 1 − overlapped/serialized
//
// The preset chips set rho to the value back-solved from the paper's own measured
// pair at each prompt length (Figure 4a: 3.46k vs 2.80k tok/s at 4k, 6.28 vs 4.73
// at 8k, 6.68 vs 4.95 at 16k). That rho climbs with prompt length is not a fudge
// — it is exactly the paper's explanation for why the penalty grows: longer
// prompts do more compute per layer, so there is more of it to hide.
//
// Only +, −, ×, ÷ here, so lib/dmath is not needed.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const TEAL = "oklch(0.58 0.10 195)"

// rho back-solved from the measured throughput pair at each prompt length,
// at L = 32 layers: rho = (R−1)/(1 − R/L), R = 1/(1 − penalty).
const PRESETS = [
  { label: "4k · measured 19%", rho: 0.244 },
  { label: "8k · measured 25%", rho: 0.348 },
  { label: "16k · measured 26%", rho: 0.367 },
] as const

const VISIBLE = 8 // layers drawn on the axis; the totals use the full L

export function PrefillPipeline() {
  const [rho, setRho] = useState(0.348)
  const [layers, setLayers] = useState(32)

  const tau = 1 // one layer's transfer, the unit of the whole picture
  const c = rho * tau

  const overlapped = layers * tau + c
  const serialized = layers * (tau + c)
  const penalty = 1 - overlapped / serialized

  // The pool stream is the hard floor: 64.4 GB of Qwen3.6 experts at the
  // 52.7 GB/s the PCIe 5.0 x16 link actually delivers.
  const POOL_GB = 64.4
  const LINK = 52.7
  const floor = POOL_GB / LINK

  const W = 720
  const H = 142
  const PAD = { l: 96, r: 12, t: 16, b: 26 }
  const iw = W - PAD.l - PAD.r
  const span = VISIBLE * (tau + c) // the serialized lane is the wider one
  const X = (t: number) => PAD.l + (t / span) * iw
  const BW = (t: number) => (t / span) * iw

  const LANE = 16
  const rows = { ot: PAD.t, oc: PAD.t + LANE + 3, st: PAD.t + 2 * LANE + 30, sc: PAD.t + 3 * LANE + 33 }

  const layerIdx = Array.from({ length: VISIBLE }, (_, i) => i)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          two full-layer buffers · transfer starts before routing is known
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          {(penalty * 100).toFixed(0)}% lost without the second buffer
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              Timeline comparing double-buffered prefill, where layer transfers and layer compute overlap, against
              a serialized version where each layer waits for its own transfer
            </title>

            <text x={4} y={rows.ot + 11} fontSize={9} fill={WARM} fontFamily="ui-monospace, monospace">
              PCIe · buf A/B
            </text>
            <text x={4} y={rows.oc + 11} fontSize={9} fill={ACCENT} fontFamily="ui-monospace, monospace">
              GPU compute
            </text>
            <text x={4} y={rows.st + 11} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              PCIe · one buf
            </text>
            <text x={4} y={rows.sc + 11} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              GPU compute
            </text>

            <text x={PAD.l} y={rows.ot - 5} fontSize={9} fill={GOOD} fontFamily="ui-monospace, monospace">
              double buffered — transfer-bound
            </text>
            <text x={PAD.l} y={rows.st - 5} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              serialized — every layer waits for its own bytes
            </text>

            {layerIdx.map((l) => {
              // overlapped: transfer l starts at l·tau, compute l starts at (l+1)·tau
              const ot = l * tau
              const oc = (l + 1) * tau
              // serialized: layer l occupies [l(tau+c), (l+1)(tau+c))
              const st = l * (tau + c)
              const sc = st + tau
              return (
                <g key={l}>
                  <rect
                    x={X(ot)}
                    y={rows.ot}
                    width={Math.max(1, BW(tau) - 2)}
                    height={LANE}
                    rx={3}
                    fill={WARM}
                    fillOpacity={l % 2 === 0 ? 0.9 : 0.55}
                  />
                  <text
                    x={X(ot) + BW(tau) / 2 - 1}
                    y={rows.ot + 11}
                    fontSize={8}
                    fill="#1c1917"
                    textAnchor="middle"
                    fontFamily="ui-monospace, monospace"
                  >
                    {l}
                    {l % 2 === 0 ? "A" : "B"}
                  </text>

                  <rect
                    x={X(oc)}
                    y={rows.oc}
                    width={Math.max(1, BW(c) - 2)}
                    height={LANE}
                    rx={3}
                    fill={ACCENT}
                    fillOpacity={l % 2 === 0 ? 0.9 : 0.55}
                  />

                  <rect
                    x={X(st)}
                    y={rows.st}
                    width={Math.max(1, BW(tau) - 2)}
                    height={LANE}
                    rx={3}
                    fill="currentColor"
                    fillOpacity={0.22}
                  />
                  <rect
                    x={X(sc)}
                    y={rows.sc}
                    width={Math.max(1, BW(c) - 2)}
                    height={LANE}
                    rx={3}
                    fill="currentColor"
                    fillOpacity={0.32}
                  />
                </g>
              )
            })}

            {/* where each version finishes its eighth layer */}
            <line x1={X(VISIBLE * tau + c)} y1={rows.ot - 2} x2={X(VISIBLE * tau + c)} y2={rows.oc + LANE + 2} stroke={GOOD} strokeWidth={1.5} />
            <line
              x1={X(VISIBLE * (tau + c))}
              y1={rows.st - 2}
              x2={X(VISIBLE * (tau + c))}
              y2={rows.sc + LANE + 2}
              stroke={WARM}
              strokeWidth={1.5}
            />
            <line
              x1={X(VISIBLE * tau + c)}
              y1={rows.oc + LANE + 2}
              x2={X(VISIBLE * tau + c)}
              y2={rows.st - 2}
              stroke={GOOD}
              strokeWidth={1}
              strokeDasharray="2 3"
              strokeOpacity={0.6}
            />

            <text
              x={X(VISIBLE * (tau + c))}
              y={H - 6}
              fontSize={9}
              fill={WARM}
              textAnchor="end"
              fontFamily="ui-monospace, monospace"
            >
              ← the gap is the hidden compute
            </text>
            <text x={PAD.l} y={H - 6} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              time → (first {VISIBLE} layers)
            </text>
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setRho(p.rho)}
              aria-pressed={Math.abs(rho - p.rho) < 1e-9}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                Math.abs(rho - p.rho) < 1e-9
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">compute/τ</span>
            <Range
              min={0.05}
              max={1.4}
              step={0.001}
              value={rho}
              onChange={(e) => setRho(Number(e.target.value))}
              className="flex-1"
              aria-label="per-layer compute time as a fraction of per-layer transfer time"
              accent={ACCENT}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {rho.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">layers</span>
            <Range
              min={8}
              max={96}
              step={1}
              value={layers}
              onChange={(e) => setLayers(Number(e.target.value))}
              className="flex-1"
              aria-label="number of MoE layers"
              accent={TEAL}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{layers}</span>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">double buffered</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: GOOD }}>
              {overlapped.toFixed(2)} τ
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">
              {layers} transfers + 1 exposed compute
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">serialized</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: WARM }}>
              {serialized.toFixed(2)} τ
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">{(penalty * 100).toFixed(1)}% of throughput lost</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">the floor it hits</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: ACCENT }}>
              {floor.toFixed(3)} s
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">64.4 GB ÷ 52.7 GB/s</div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The rightmost box is the number to hold onto. FreeToken&rsquo;s measured 8,192-token prefill chunk
          completes in <span className="text-foreground">1.19–1.22 s</span>, and streaming Qwen3.6&rsquo;s 64.4 GB
          expert pool once across a PCIe 5.0 ×16 link at its achieved 52.7 GB/s takes{" "}
          <span className="font-mono text-[11px] text-foreground">{floor.toFixed(3)} s</span>. Prefill is not
          slightly transfer-bound; it is sitting exactly on the link. The whole of the model&rsquo;s expert
          computation has disappeared underneath the wire.
          <br />
          <br />
          Which is also why the penalty for removing the second buffer <em>grows</em>{" "}with prompt length — 19% at
          4k, 25% at 8k, 26% at 16k. Longer prompts do proportionally more compute per layer, so serializing
          exposes more of it. Drag the ratio up and the two finish lines pull apart; the transfer lane never
          moves, because nothing about it can be made faster than the link.
        </p>
      </div>
    </figure>
  )
}

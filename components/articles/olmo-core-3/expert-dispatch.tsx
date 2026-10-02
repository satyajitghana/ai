"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The one move that separates Olmo-core 3 from Olmo-core 2, drawn as data flow across
// four GPUs that together hold eight routed experts.
//
//  gather (Olmo-core 2): FSDP re-gathers every expert's weights onto every GPU around
//  each microbatch, then frees them. The bytes moved track TOTAL parameters, so adding
//  experts at fixed active size still costs more every step — the "capacity tax".
//
//  route (Olmo-core 3): experts stay resident on the GPU that owns them. Expert
//  parallelism sends only the selected token rows to that GPU (an all-to-all dispatch),
//  runs the expert, and sends the results back (combine). Nothing re-gathers the weights.
//
// The two flows are the same picture with the arrows reversed: weights to the data, or
// data to the weights.

const G = 4 // GPUs
const E = 8 // routed experts total, 2 per GPU
const PERGPU = E / G

const W = 760
const H = 290

// GPU chip geometry (bottom row)
const CW = 150
const CH = 86
const CY = H - CH - 30
const GAP = (W - G * CW) / (G + 1)
const cx = (g: number) => GAP + g * (CW + GAP) + CW / 2 // chip centre x
const topHub = { x: W / 2, y: 34 } // pool / token source

const BLUE = "oklch(0.62 0.17 255)"
const GREEN = "oklch(0.64 0.17 150)"
const RED = "oklch(0.62 0.2 25)"

// Which expert each token is routed to (fixed demo routing). GPU g owns experts
// {2g+1, 2g+2}, so each token's target expert must live on the GPU it is sent to.
const TOKENS = [
  { e: 1, g: 0 },
  { e: 3, g: 1 },
  { e: 6, g: 2 },
  { e: 8, g: 3 },
]

export function ExpertDispatch() {
  const [mode, setMode] = useState<"gather" | "route">("route")
  const gather = mode === "gather"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">8 experts · 4 GPUs · top-k routing</span>
        <div className="flex gap-1">
          {[
            { v: "gather" as const, label: "Olmo-core 2 · gather weights" },
            { v: "route" as const, label: "Olmo-core 3 · route tokens" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMode(o.v)}
              aria-pressed={mode === o.v}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                mode === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={
            gather
              ? "Olmo-core 2: every expert's weights are gathered onto every one of four GPUs each microbatch."
              : "Olmo-core 3: experts stay resident on four GPUs; only the selected token rows are routed to the GPU that owns each expert."
          }
        >
          <defs>
            <marker id="ed-arr-b" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={BLUE} strokeWidth={1.5} />
            </marker>
            <marker id="ed-arr-g" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={GREEN} strokeWidth={1.5} />
            </marker>
            <marker id="ed-arr-r" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={RED} strokeWidth={1.5} />
            </marker>
          </defs>

          {/* ---- top hub: expert pool (gather) or token source (route) ---- */}
          {gather ? (
            <g>
              <rect x={topHub.x - 150} y={14} width={300} height={34} rx={8} fill="var(--background)" stroke={RED} strokeWidth={1.5} />
              <text x={topHub.x} y={35} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>
                all 8 experts (full weights)
              </text>
            </g>
          ) : (
            <g>
              {TOKENS.map((t, k) => {
                const tx = topHub.x - 90 + k * 60
                return (
                  <g key={k}>
                    <rect x={tx - 16} y={16} width={32} height={26} rx={6} fill="var(--background)" stroke={BLUE} strokeWidth={1.4} />
                    <text x={tx} y={34} textAnchor="middle" className="fill-foreground font-mono" fontSize={11}>
                      t{k + 1}
                    </text>
                  </g>
                )
              })}
              <text x={topHub.x + 120} y={34} textAnchor="start" className="fill-muted-foreground font-mono" fontSize={10}>
                token rows
              </text>
            </g>
          )}

          {/* ---- flow lines ---- */}
          {gather
            ? // weights copied to every GPU
              Array.from({ length: G }).map((g, gi) => {
                const x2 = cx(gi)
                const y1 = 50
                const y2 = CY - 2
                return (
                  <path
                    key={gi}
                    d={`M ${topHub.x} ${y1} C ${topHub.x} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={RED}
                    strokeWidth={2}
                    strokeDasharray="6 6"
                    markerEnd="url(#ed-arr-r)"
                    opacity={0.9}
                  >
                    <animate attributeName="stroke-dashoffset" from="12" to="0" dur="0.7s" repeatCount="indefinite" />
                  </path>
                )
              })
            : // token rows dispatched to the GPU that owns the target expert
              TOKENS.map((t, k) => {
                const x1 = topHub.x - 90 + k * 60
                const x2 = cx(t.g)
                const y1 = 44
                const y2 = CY - 2
                return (
                  <path
                    key={k}
                    d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={BLUE}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    markerEnd="url(#ed-arr-b)"
                    opacity={0.9}
                  >
                    <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.6s" repeatCount="indefinite" />
                  </path>
                )
              })}

          {/* ---- GPU chips with resident experts ---- */}
          {Array.from({ length: G }).map((g, gi) => {
            const x = cx(gi) - CW / 2
            const owns = TOKENS.some((t) => t.g === gi)
            return (
              <g key={gi}>
                <rect x={x} y={CY} width={CW} height={CH} rx={10} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} />
                <text x={x + 10} y={CY + 18} className="fill-muted-foreground font-mono" fontSize={10}>
                  GPU {gi}
                </text>
                {/* experts resident on this GPU (route) or gathered copies (gather) */}
                {Array.from({ length: gather ? E : PERGPU }).map((e, ei) => {
                  const perRow = gather ? 4 : 2
                  const bw = gather ? 28 : 56
                  const bh = gather ? 18 : 28
                  const col = ei % perRow
                  const row = Math.floor(ei / perRow)
                  const bx = x + 10 + col * (bw + 6)
                  const by = CY + 26 + row * (bh + 6)
                  const residentId = gi * PERGPU + ei + 1
                  const isTarget = !gather && owns && TOKENS.some((t) => t.g === gi && t.e === residentId)
                  return (
                    <g key={ei}>
                      <rect
                        x={bx}
                        y={by}
                        width={bw}
                        height={bh}
                        rx={4}
                        fill={gather ? "color-mix(in oklch, var(--background) 82%, " + RED + ")" : isTarget ? "color-mix(in oklch, var(--background) 72%, " + GREEN + ")" : "var(--muted)"}
                        stroke={gather ? RED : isTarget ? GREEN : "var(--border)"}
                        strokeWidth={1.2}
                        opacity={gather ? 0.7 : 1}
                      />
                      {!gather ? (
                        <text x={bx + bw / 2} y={by + bh / 2 + 4} textAnchor="middle" className="font-mono" fontSize={10} fill={isTarget ? GREEN : "var(--muted-foreground)"} fontWeight={isTarget ? 600 : 400}>
                          E{residentId}
                        </text>
                      ) : null}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>

        <div
          className="mt-3 rounded-md border px-3 py-2 font-mono text-xs"
          style={gather ? { borderColor: RED, color: "var(--foreground)" } : { borderColor: GREEN, color: "var(--foreground)" }}
        >
          {gather
            ? "Olmo-core 2 · FSDP re-gathers all 8 experts' weights onto every GPU each microbatch, then frees them. Bytes moved scale with total parameters — the capacity tax."
            : "Olmo-core 3 · Experts stay resident; EP sends only the selected token rows to the GPU that owns their expert (all-to-all dispatch), runs it, and sends results back (combine)."}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The difference is which thing moves. Olmo-core 2 moves the{" "}
          <span className="text-foreground">weights to the data</span>, re-gathering the whole
          (growing) expert pool every microbatch. Olmo-core 3 keeps the experts put and moves
          the <span className="text-foreground">data to the weights</span> — only the handful of
          token rows each expert was routed. That is the all-to-all{" "}
          <span style={{ color: GREEN }}>dispatch</span> and{" "}
          <span style={{ color: GREEN }}>combine</span> at the heart of expert parallelism, and
          it is why throughput stops falling as you add experts.
        </p>
      </div>
    </figure>
  )
}
